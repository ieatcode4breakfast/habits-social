import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, createTestUser, createFriendship, deleteTestUser } from './test.utils';
import { ChatService } from '../services/chat.service';
import { chatMessages, chatParticipants } from '../db/schema';
import { sql, eq, and } from 'drizzle-orm';

describe('Chat Service', () => {
  let userA: any;
  let userB: any;
  let userC: any;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`UserA_${id}`, `usera_${id}@example.com`);
    userB = await createTestUser(`UserB_${id}`, `userb_${id}@example.com`);
    userC = await createTestUser(`UserC_${id}`, `userc_${id}@example.com`);
    await createFriendship(userA.id, userB.id, 'accepted');
  });

  afterEach(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  describe('getOrCreateConversationForFriend', () => {
    it('should create a conversation for accepted friends', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      expect(conv).toBeDefined();
      expect(conv?.id).toBeDefined();
    });

    it('should reuse existing conversation for the same pair', async () => {
      const conv1 = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const conv2 = await ChatService.getOrCreateConversationForFriend(db, userB.id, userA.id);
      expect(conv1?.id).toBe(conv2?.id);
    });

    it('should reject if friendship is not accepted', async () => {
      await createFriendship(userA.id, userC.id, 'pending');
      await expect(ChatService.getOrCreateConversationForFriend(db, userA.id, userC.id)).rejects.toThrow();
    });

    it('should reject if no friendship exists', async () => {
      await expect(ChatService.getOrCreateConversationForFriend(db, userB.id, userC.id)).rejects.toThrow();
    });

    it('should reject self-chat', async () => {
      await expect(ChatService.getOrCreateConversationForFriend(db, userA.id, userA.id)).rejects.toThrow();
    });

    it('should handle concurrent creation requests gracefully', async () => {
      const results = await Promise.all([
        ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id),
        ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id)
      ]);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[0]?.id).toBe(results[1]?.id);
    });
  });

  describe('sendMessage', () => {
    it('should store message and update lastMessageAt', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const before = new Date(conv!.lastMessageAt!).getTime();
      
      // Artificial delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const msg: any = await ChatService.sendMessage(db, userA.id, conv!.id, 'Hello!');
      expect(msg.body).toBe('Hello!');
      expect(msg.senderId).toBe(userA.id);
      
      const updatedConv: any = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      expect(new Date(updatedConv.lastMessageAt).getTime()).toBeGreaterThan(before);
    });

    it('should reject if user is not a participant', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await expect(ChatService.sendMessage(db, userC.id, conv!.id, 'I am an intruder')).rejects.toThrow();
    });
  });

  describe('listConversations', () => {
    it('should list conversations sorted by lastMessageAt descending', async () => {
      const convAB = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, convAB!.id, 'Msg 1');
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await createFriendship(userA.id, userC.id, 'accepted');
      const convAC = await ChatService.getOrCreateConversationForFriend(db, userA.id, userC.id);
      await ChatService.sendMessage(db, userA.id, convAC!.id, 'Msg 2');
      
      const conversations = await ChatService.listConversations(db, userA.id);
      expect(conversations.length).toBe(2);
      expect(conversations[0]?.id).toBe(convAC!.id);
      expect(conversations[1]?.id).toBe(convAB!.id);
    });

    it('should include the latest message preview and deletion state', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'Older message');
      await new Promise(resolve => setTimeout(resolve, 10));
      const latest = await ChatService.sendMessage(db, userB.id, conv!.id, 'Latest preview');

      let conversations = await ChatService.listConversations(db, userA.id);
      expect((conversations[0] as any)?.lastMessageBody).toBe('Latest preview');
      expect((conversations[0] as any)?.lastMessageSenderId).toBe(userB.id);
      expect((conversations[0] as any)?.lastMessageDeletedAt).toBeNull();

      await ChatService.deleteMessage(db, userB.id, latest.id);

      conversations = await ChatService.listConversations(db, userA.id);
      expect((conversations[0] as any)?.lastMessageBody).toBe('');
      expect((conversations[0] as any)?.lastMessageDeletedAt).not.toBeNull();
    });
  });

  describe('Unread State and Pagination', () => {
    it('should calculate unread counts correctly', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      
      // Send 3 messages from B to A
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 1');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 2');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 3');
      
      const convsA = await ChatService.listConversations(db, userA.id);
      expect(convsA[0]?.unreadCount).toBe(3);
      
      const convsB = await ChatService.listConversations(db, userB.id);
      expect(convsB[0]?.unreadCount).toBe(0); // B sent them, should be 0 unread for B
    });

    it('should mark conversation as read', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 1');
      
      await ChatService.markAsRead(db, userA.id, conv!.id);
      
      const convsA = await ChatService.listConversations(db, userA.id);
      expect(convsA[0]?.unreadCount).toBe(0);
    });

    it('should paginate messages', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      for (let i = 1; i <= 5; i++) {
        await ChatService.sendMessage(db, userA.id, conv!.id, `Msg ${i}`);
        await new Promise(resolve => setTimeout(resolve, 5)); // Ensure unique timestamps
      }
      
      const page1 = await ChatService.listMessages(db, userA.id, conv!.id, { limit: 3 });
      expect(page1.messages.length).toBe(3);
      expect(page1.messages[0]?.body).toBe('Msg 5');
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBeDefined();
      
      const page2 = await ChatService.listMessages(db, userA.id, conv!.id, { limit: 3, cursor: page1.cursor });
      expect(page2.messages.length).toBe(2);
      expect(page2.messages[0]?.body).toBe('Msg 2');
      expect(page2.hasMore).toBe(false);
    }, 15000);

    it('should reject third-party message listing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await expect(ChatService.listMessages(db, userC.id, conv!.id)).rejects.toThrow();
    });
  });

  describe('clearConversation', () => {
    it('should correctly hide pre-clear messages from listMessages for clearer', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'msg2');
      
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      const page = await ChatService.listMessages(db, userA.id, conv!.id);
      expect(page.messages.length).toBe(0);
    });

    it('should NOT hide messages for the non-clearer', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'msg2');
      
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      const page = await ChatService.listMessages(db, userB.id, conv!.id);
      expect(page.messages.length).toBe(2);
    });

    it('should throw unauthorized if non-participant tries to clear', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await expect(ChatService.clearConversation(db, userC.id, conv!.id)).rejects.toThrow();
    });

    it('should remove cleared conversations from listConversations for the clearer', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      const convs = await ChatService.listConversations(db, userA.id);
      expect(convs.find(c => c.id === conv!.id)).toBeUndefined();
    });

    it('should keep cleared conversations in listConversations for the non-clearer', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      const convs = await ChatService.listConversations(db, userB.id);
      expect(convs.find(c => c.id === conv!.id)).toBeDefined();
    });

    it('should make conversation reappear if a new message is sent after clearing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      // Send a new message after clear
      await ChatService.sendMessage(db, userB.id, conv!.id, 'msg2');
      
      const convs = await ChatService.listConversations(db, userA.id);
      const found = convs.find(c => c.id === conv!.id);
      expect(found).toBeDefined();
      expect((found as any).lastMessageBody).toBe('msg2');
    });

    it('should make conversation reappear if a new message is sent and deleted after clearing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      
      await ChatService.clearConversation(db, userA.id, conv!.id);
      
      // Send a new message after clear and delete it
      const newMsg = await ChatService.sendMessage(db, userB.id, conv!.id, 'msg2');
      await ChatService.deleteMessage(db, userB.id, newMsg.id);
      
      const convs = await ChatService.listConversations(db, userA.id);
      const found = convs.find(c => c.id === conv!.id);
      expect(found).toBeDefined();
      expect((found as any).lastMessageBody).toBe('');
      expect((found as any).lastMessageDeletedAt).not.toBeNull();
    });

    it('Boundary Condition - Negative: createdAt === clearedAt is hidden', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const msgId = crypto.randomUUID();
      
      // Insert message and set clearedAt to the exact same database transaction timestamp
      await db.transaction(async (tx) => {
        await tx.insert(chatMessages).values({
          id: msgId,
          conversationId: conv!.id,
          senderId: userA.id,
          body: 'exact time',
          createdAt: sql`now()`
        });
        
        await tx.update(chatParticipants)
          .set({ clearedAt: sql`now()` })
          .where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userA.id)));
      });

      const page = await ChatService.listMessages(db, userA.id, conv!.id);
      expect(page.messages.length).toBe(0);
    });

    it('Boundary Condition - Positive: createdAt > clearedAt is visible', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      
      // Set clearedAt, then insert a message with a timestamp explicitly 1 second in the future
      await db.transaction(async (tx) => {
        await tx.update(chatParticipants)
          .set({ clearedAt: sql`now()` })
          .where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userA.id)));
          
        await tx.insert(chatMessages).values({
          id: crypto.randomUUID(),
          conversationId: conv!.id,
          senderId: userA.id,
          body: 'future message',
          createdAt: sql`now() + interval '1 second'`
        });
      });

      const page = await ChatService.listMessages(db, userA.id, conv!.id);
      expect(page.messages.length).toBe(1);
    });

    it('should only update the clearer\'s participant row', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.clearConversation(db, userA.id, conv!.id);

      const [pA] = await db.select().from(chatParticipants).where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userA.id)));
      const [pB] = await db.select().from(chatParticipants).where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userB.id)));

      expect(pA!.clearedAt).not.toBeNull();
      expect(pB!.clearedAt).toBeNull();
    });

    it('should not delete messages from the database', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'msg1');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'msg2');

      const resBefore = await db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(eq(chatMessages.conversationId, conv!.id));
      const beforeCount = resBefore[0]!.count;
      
      await ChatService.clearConversation(db, userA.id, conv!.id);

      const resAfter = await db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(eq(chatMessages.conversationId, conv!.id));
      const afterCount = resAfter[0]!.count;
      
      expect(Number(afterCount)).toBe(Number(beforeCount));
      expect(Number(afterCount)).toBeGreaterThan(0);
    });

    it('should handle idempotent double clear safely', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.clearConversation(db, userA.id, conv!.id);
      await ChatService.clearConversation(db, userA.id, conv!.id);

      const [pA] = await db.select().from(chatParticipants).where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userA.id)));
      expect(pA!.clearedAt).not.toBeNull();
    });

    it('should show new messages sent by the clearer after clearing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userB.id, conv!.id, 'before clear');
      
      await ChatService.clearConversation(db, userA.id, conv!.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'after clear');

      const page = await ChatService.listMessages(db, userA.id, conv!.id);
      expect(page.messages.length).toBe(1);
      expect(page.messages[0]!.body).toBe('after clear');
    });

    it('should exclude cleared messages from unread counts', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      // User B sends a message to User A
      await ChatService.sendMessage(db, userB.id, conv!.id, 'unread message');
      
      let convs = await ChatService.listConversations(db, userA.id);
      expect(convs[0]!.unreadCount).toBe(1);

      await ChatService.clearConversation(db, userA.id, conv!.id);

      // Now A sends a message so it appears again
      await ChatService.sendMessage(db, userA.id, conv!.id, 'new msg');
      convs = await ChatService.listConversations(db, userA.id);
      expect(convs[0]!.unreadCount).toBe(0); // The previous unread is ignored
    });

    it('should throw structured 500 when participant row is missing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await db.delete(chatParticipants).where(and(eq(chatParticipants.conversationId, conv!.id), eq(chatParticipants.userId, userA.id)));

      await expect(ChatService.clearConversation(db, userA.id, conv!.id)).rejects.toMatchObject({
        statusCode: 500
      });
    });
  });
});
