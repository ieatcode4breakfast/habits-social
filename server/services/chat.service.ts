import { eq, and, or, desc, sql, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { DBConnection } from '../types/db';
import * as schema from '../db/schema';
import type { 
  ConversationListItem, 
  PaginatedMessages, 
  ChatConversation, 
  ChatMessage 
} from '../types/chat';
import * as realtimeNotifier from '../utils/realtimeNotifier';
import { PushService } from './push.service';
import { createError } from 'h3';
import type { FeedItem } from './social-narrator.service';

const getErrorCode = (error: unknown): string => {
  if (!error || typeof error !== 'object') return '';
  const record = error as Record<string, unknown>;
  const cause = record.cause && typeof record.cause === 'object'
    ? record.cause as Record<string, unknown>
    : undefined;
  return String(record.code || cause?.code || '');
};

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : '';

const notifyChatChanged = (conversation: ChatConversation, actorId: string): void => {
  const participantIds = [conversation.user1Id, conversation.user2Id].filter((userId): userId is string => typeof userId === 'string');
  const recipients = [actorId, ...participantIds.filter((userId) => userId !== actorId)];
  void realtimeNotifier.notifyUsersRealtime(recipients, { type: 'chat.changed' }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown realtime notification failure';
    console.warn('[Realtime] Chat invalidation failed:', message);
  });
};

export class ChatService {
  /**
   * Gets or creates a conversation for a friend pair.
   * Requires an accepted friendship.
   */
  static async getOrCreateConversationForFriend(db: DBConnection, userId: string, friendId: string): Promise<ChatConversation> {
    if (userId === friendId) throw new Error('Self-chat not allowed');

    // Find accepted friendship
    const [friendship] = await db.select()
      .from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.status, 'accepted'),
          or(
            and(eq(schema.friendships.initiatorId, userId), eq(schema.friendships.receiverId, friendId)),
            and(eq(schema.friendships.initiatorId, friendId), eq(schema.friendships.receiverId, userId))
          )
        )


      );

    if (!friendship) throw new Error('Accepted friendship required');

    // Find existing conversation using the unique user pair index
    const [u1, u2] = userId < friendId ? [userId, friendId] : [friendId, userId];
    let [conv] = await db.select()
      .from(schema.chatConversations)
      .where(
        and(
          eq(schema.chatConversations.user1Id, u1),
          eq(schema.chatConversations.user2Id, u2)
        )
      );

    if (!conv) {
      // Create conversation and participants in a transaction
      try {
        const result = await db.transaction(async (tx) => {
          const convId = crypto.randomUUID();
          const [newConv] = await tx.insert(schema.chatConversations)
            .values({
              id: convId,
              user1Id: u1,
              user2Id: u2,
              lastMessageAt: sql`now()`,
              createdAt: sql`now()`,
              updatedAt: sql`now()`
            })
            .returning();

          // Create participants with lastReadAt strictly in the past to ensure first messages are unread
          await tx.insert(schema.chatParticipants)
            .values([
              { conversationId: convId, userId: u1, lastReadAt: sql`now() - interval '1 second'` },
              { conversationId: convId, userId: u2, lastReadAt: sql`now() - interval '1 second'` }
            ]);

          return newConv;
        });

        if (!result) throw new Error('Failed to create conversation');
        return result;
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        const code = getErrorCode(error);
        if (code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate key value')) {
          const [existingConv] = await db.select()
            .from(schema.chatConversations)
            .where(
              and(
                eq(schema.chatConversations.user1Id, u1),
                eq(schema.chatConversations.user2Id, u2)
              )
            );
          if (existingConv) return existingConv;
        }
        throw error;
      }
    }

    return conv;
  }

  /**
   * Verifies access to a conversation.
   * - Full access (read/write) requires an accepted friendship.
   * - Read-only access is allowed if the other participant has deleted their account.
   * - Access is denied if the other participant exists but no accepted friendship exists.
   */
  static async verifyAccess(db: DBConnection, userId: string, conversationId: string, mode: 'read' | 'write' = 'read'): Promise<ChatConversation> {
    const [conv] = await db.select()
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.id, conversationId));

    if (!conv) throw new Error('Conversation not found');

    if (conv.user1Id !== userId && conv.user2Id !== userId) {
       throw new Error('Unauthorized access to conversation');
    }

    const otherParticipantId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;

    if (!otherParticipantId) {
      // Other user deleted their account (null ID)
      if (mode === 'write') throw new Error('Cannot send messages to a deleted user');
      return conv; // Allow read access
    }

    // Check if other participant exists
    const [otherUser] = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, otherParticipantId));

    if (!otherUser) {
      // Other user deleted their account (ID exists but user record gone - though schema uses set null so this is fallback)
      if (mode === 'write') throw new Error('Cannot send messages to a deleted user');
      return conv; // Allow read access
    }

    // Other user exists, check friendship
    const [friendship] = await db.select()
      .from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.status, 'accepted'),
          or(
            and(eq(schema.friendships.initiatorId, userId), eq(schema.friendships.receiverId, otherParticipantId)),
            and(eq(schema.friendships.initiatorId, otherParticipantId), eq(schema.friendships.receiverId, userId))
          )
        )
      );

    if (!friendship) {
      throw new Error('Active friendship required to access chat');
    }

    return conv;
  }

  /**
   * Sends a message in a conversation.
   * Updates lastMessageAt and enforces active friendship.
   */
  static async sendMessage(
    db: DBConnection,
    senderId: string,
    conversationId: string,
    body: string,
    replyToActivity?: FeedItem,
    waitUntil?: (promise: Promise<unknown>) => void
  ): Promise<ChatMessage> {
    const conversation = await this.verifyAccess(db, senderId, conversationId, 'write');

    if (replyToActivity) {
      const otherParticipantId = conversation.user1Id === senderId ? conversation.user2Id : conversation.user1Id;
      const allowedIds = [senderId, otherParticipantId].filter((id): id is string => typeof id === 'string');
      
      if (!allowedIds.includes(replyToActivity.user.id)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid activity owner in visual card context'
        });
      }
    }

    const message = await db.transaction(async (tx) => {
      // Insert message
      const [message] = await tx.insert(schema.chatMessages)
        .values({
          id: crypto.randomUUID(),
          conversationId,
          senderId,
          body,
          replyToActivity: replyToActivity || null,
          createdAt: sql`now()`
        })
        .returning();

      if (!message) throw new Error('Failed to send message');

      // Update conversation lastMessageAt
      await tx.update(schema.chatConversations)
        .set({ lastMessageAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(schema.chatConversations.id, conversationId));

      // Update sender's lastReadAt
      await tx.update(schema.chatParticipants)
        .set({ lastReadAt: sql`now()` })
        .where(
          and(
            eq(schema.chatParticipants.conversationId, conversationId),
            eq(schema.chatParticipants.userId, senderId)
          )
        );

      return message;
    });

    notifyChatChanged(conversation, senderId);

    const otherParticipantId = conversation.user1Id === senderId ? conversation.user2Id : conversation.user1Id;
    if (otherParticipantId) {
      const pushPromise = PushService.notifyUser(
        db, otherParticipantId, senderId, body,
        replyToActivity?.type,
        replyToActivity?.message,
      ).catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : 'Unknown push notification failure';
        console.warn('[Push] Chat notification failed:', msg);
      });
      if (waitUntil) {
        waitUntil(pushPromise);
      }
    }

    return message;
  }

  static getVisibilityPredicate(messagesTable: any, participantsTable: any): SQL {
    return or(
      isNull(participantsTable.clearedAt),
      sql`${messagesTable.createdAt} > ${participantsTable.clearedAt}`
    )!;
  }

  /**
   * Lists conversations for a user, sorted by recent activity.
   * Includes unread counts per user.
   * Uses a declarative Authorization Join to filter active/archived chats.
   */
  static async listConversations(db: DBConnection, userId: string): Promise<ConversationListItem[]> {
    const f = schema.friendships;
    const c = schema.chatConversations;
    const p = schema.chatParticipants;
    const m = schema.chatMessages;

    return await db.select({
      id: c.id,
      lastMessageAt: c.lastMessageAt,
      lastMessageBody: sql<string | null>`(
        SELECT ${m.body}
        FROM ${m}
        WHERE ${m.conversationId} = ${c.id}
          AND (${this.getVisibilityPredicate(m, p)})
        ORDER BY ${m.createdAt} DESC, ${m.id} DESC
        LIMIT 1
      )`,
      lastMessageDeletedAt: sql<Date | null>`(
        SELECT ${m.deletedAt}
        FROM ${m}
        WHERE ${m.conversationId} = ${c.id}
          AND (${this.getVisibilityPredicate(m, p)})
        ORDER BY ${m.createdAt} DESC, ${m.id} DESC
        LIMIT 1
      )`,
      lastMessageSenderId: sql<string | null>`(
        SELECT ${m.senderId}
        FROM ${m}
        WHERE ${m.conversationId} = ${c.id}
          AND (${this.getVisibilityPredicate(m, p)})
        ORDER BY ${m.createdAt} DESC, ${m.id} DESC
        LIMIT 1
      )`,
      user1Id: c.user1Id,
      user2Id: c.user2Id,
      unreadCount: sql<number>`(
        SELECT count(*)::int
        FROM ${m}
        WHERE ${m.conversationId} = ${c.id}
          AND (${this.getVisibilityPredicate(m, p)})
          AND ${m.createdAt} > ${p.lastReadAt}
          AND ${m.senderId} != ${userId}
      )`
    })
      .from(c)
      .innerJoin(p, eq(c.id, p.conversationId))
      .leftJoin(f, and(
        eq(sql`LEAST(${c.user1Id}, ${c.user2Id})`, sql`LEAST(${f.initiatorId}, ${f.receiverId})`),
        eq(sql`GREATEST(${c.user1Id}, ${c.user2Id})`, sql`GREATEST(${f.initiatorId}, ${f.receiverId})`)
      ))
      .where(
        and(
          eq(p.userId, userId),
          sql`EXISTS (
            SELECT 1 FROM ${m}
            WHERE ${m.conversationId} = ${c.id}
              AND (${this.getVisibilityPredicate(m, p)})
          )`,
          eq(f.status, 'accepted')
        )
      )
      .orderBy(desc(c.lastMessageAt));
  }

  /**
   * Clears a conversation for a user.
   * Only affects the clearer's visibility.
   */
  static async clearConversation(db: DBConnection, userId: string, conversationId: string): Promise<void> {
    const [conv] = await db.select()
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.id, conversationId));
    
    if (!conv) throw createError({ statusCode: 404, statusMessage: 'Not Found' });
    if (conv.user1Id !== userId && conv.user2Id !== userId) {
       throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }

    const result = await db.update(schema.chatParticipants)
      .set({ clearedAt: sql`now()`, lastReadAt: sql`now()` })
      .where(
        and(
          eq(schema.chatParticipants.conversationId, conversationId),
          eq(schema.chatParticipants.userId, userId)
        )
      );

    if (result.rowCount === 0) {
      throw createError({ statusCode: 500, statusMessage: 'Internal Server Error', message: 'Chat participant invariant failed' });
    }
  }

  /**
   * Marks a conversation as read for a specific user.
   */
  static async markAsRead(db: DBConnection, userId: string, conversationId: string): Promise<void> {
    // Verify membership and friendship
    await this.verifyAccess(db, userId, conversationId, 'read');

    const result = await db.update(schema.chatParticipants)
      .set({ lastReadAt: sql`now()` })
      .where(
        and(
          eq(schema.chatParticipants.conversationId, conversationId),
          eq(schema.chatParticipants.userId, userId)
        )
      );
    
    if (result.rowCount === 0) throw new Error('Failed to update read state');
  }

  /**
   * Lists messages in a conversation with deterministic cursor pagination.
   * Enforces active friendship.
   */
  static async listMessages(db: DBConnection, userId: string, conversationId: string, options: { limit?: number, cursor?: string } = {}): Promise<PaginatedMessages> {
    await this.verifyAccess(db, userId, conversationId, 'read');
    
    // Fetch participant row to enforce visibility boundary
    const [participant] = await db.select()
      .from(schema.chatParticipants)
      .where(
        and(
          eq(schema.chatParticipants.conversationId, conversationId),
          eq(schema.chatParticipants.userId, userId)
        )
      );
      
    if (!participant) {
      throw createError({ statusCode: 500, statusMessage: 'Internal Server Error', message: 'Chat participant row invariant failed' });
    }

    const { limit = 50, cursor } = options;
    const filters: SQL[] = [eq(schema.chatMessages.conversationId, conversationId)];
    
    if (participant.clearedAt) {
      filters.push(
        sql`${schema.chatMessages.createdAt} > (SELECT cleared_at FROM chat_participants WHERE conversation_id = ${conversationId} AND user_id = ${userId})`
      );
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        const [cursorCreatedAt, cursorId] = decoded.split('|');
        if (cursorCreatedAt && cursorId) {
          const cursorDate = new Date(cursorCreatedAt);
          if (!isNaN(cursorDate.getTime())) {
            const cursorFilter = or(
              sql`${schema.chatMessages.createdAt} < ${cursorDate}`,
              and(
                eq(schema.chatMessages.createdAt, cursorDate),
                sql`${schema.chatMessages.id} < ${cursorId}`
              )
            );
            if (cursorFilter) filters.push(cursorFilter);
          }
        }
      } catch {
        // Invalid cursor, ignore
      }
    }

    const messages = await db.select()
      .from(schema.chatMessages)
      .where(and(...filters))
      .orderBy(desc(schema.chatMessages.createdAt), desc(schema.chatMessages.id))
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    let nextCursor: string | undefined;
    if (hasMore && resultMessages.length > 0) {
      const last = resultMessages[resultMessages.length - 1];
      if (last && last.createdAt) {
        nextCursor = Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64');
      }
    }

    return {
      messages: resultMessages,
      hasMore,
      cursor: nextCursor
    };
  }

  /**
   * Deletes a message (tombstoning).
   * Only the sender can delete their own message.
   * Requires 'write' access (active friendship) to the conversation.
   */
  static async deleteMessage(db: DBConnection, userId: string, messageId: string): Promise<void> {
    const [message] = await db.select()
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.id, messageId),
          eq(schema.chatMessages.senderId, userId)
        )
      );

    if (!message) throw new Error('Message not found or unauthorized');

    // Verify 'write' access to the conversation (locks deletion if unfriended)
    const conversation = await this.verifyAccess(db, userId, message.conversationId, 'write');

    await db.update(schema.chatMessages)
      .set({ body: '', deletedAt: new Date() })
      .where(eq(schema.chatMessages.id, messageId));

    notifyChatChanged(conversation, userId);
  }

  /**
   * Tombstones all messages from a user upon account deletion.
   */
  static async tombstoneUserMessages(db: DBConnection, userId: string): Promise<void> {
    await db.update(schema.chatMessages)
      .set({ body: '', senderId: null, deletedAt: new Date() })
      .where(eq(schema.chatMessages.senderId, userId));
  }
}
