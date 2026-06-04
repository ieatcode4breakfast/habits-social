import { eq, and, or, sql } from 'drizzle-orm';
import { friendships as friendshipsTable, habits, habitLogs, userBlocks, users } from '~~/server/db/schema';
import { extractRows } from '~~/server/utils/db';
import type { DBConnection } from '~~/server/types/db';
import type { Friendship, UserBlock } from '~~/server/types';
import * as realtimeNotifier from '~~/server/utils/realtimeNotifier';

const isUniqueConstraintError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  return record.code === '23505';
};

const notifyFriendsChanged = (userIds: readonly string[]): void => {
  void realtimeNotifier.notifyUsersRealtime(userIds, { type: 'friends.changed' }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown realtime notification failure';
    console.warn('[Realtime] Friends invalidation failed:', message);
  });
};

const friendshipPairCondition = (u1: string, u2: string) => or(
  and(eq(friendshipsTable.initiatorId, u1), eq(friendshipsTable.receiverId, u2)),
  and(eq(friendshipsTable.initiatorId, u2), eq(friendshipsTable.receiverId, u1))
)!;

const blockPairCondition = (u1: string, u2: string) => or(
  and(eq(userBlocks.blockerId, u1), eq(userBlocks.blockedId, u2)),
  and(eq(userBlocks.blockerId, u2), eq(userBlocks.blockedId, u1))
)!;

export const SocialService = {
  async hasBlockBetween(db: DBConnection, u1: string, u2: string): Promise<boolean> {
    const [block] = await db.select({
      blockerId: userBlocks.blockerId
    })
      .from(userBlocks)
      .where(blockPairCondition(u1, u2))
      .limit(1);

    return Boolean(block);
  },

  async blockUser(db: DBConnection, blockerId: string, blockedId: string): Promise<UserBlock> {
    if (blockerId === blockedId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot block yourself' });
    }

    const [targetUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, blockedId));

    if (!targetUser) {
      throw createError({ statusCode: 404, statusMessage: 'Target user not found' });
    }

    const outcome = await db.transaction(async (tx) => {
      const [existingFriendship] = await tx.select()
        .from(friendshipsTable)
        .where(friendshipPairCondition(blockerId, blockedId));

      const inserted = await tx.insert(userBlocks)
        .values({
          blockerId,
          blockedId,
          createdAt: new Date()
        })
        .onConflictDoNothing()
        .returning();

      if (existingFriendship) {
        await SocialService.cleanupFriendshipData(tx, blockerId, blockedId);
        await tx.delete(friendshipsTable).where(eq(friendshipsTable.id, existingFriendship.id));
      }

      const block = inserted[0] ?? (await tx.select()
        .from(userBlocks)
        .where(and(
          eq(userBlocks.blockerId, blockerId),
          eq(userBlocks.blockedId, blockedId)
        )))[0];

      if (!block) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to block user' });
      }

      return {
        block,
        changed: inserted.length > 0 || Boolean(existingFriendship)
      };
    });

    if (outcome.changed) {
      notifyFriendsChanged([blockerId, blockedId]);
    }

    return outcome.block;
  },

  async unblockUser(db: DBConnection, blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot unblock yourself' });
    }

    const deleted = await db.delete(userBlocks)
      .where(and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      ))
      .returning({ blockerId: userBlocks.blockerId });

    if (deleted.length > 0) {
      notifyFriendsChanged([blockerId, blockedId]);
    }

    return deleted.length > 0;
  },

  async createFriendship(db: DBConnection, initiatorId: string, targetUserId: string, event: unknown): Promise<Friendship> {
    if (initiatorId === targetUserId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot friend yourself' });
    }

    if (await this.hasBlockBetween(db, initiatorId, targetUserId)) {
      throw createError({ statusCode: 403, statusMessage: 'Friendship unavailable' });
    }

    let result: Friendship[];
    try {
      result = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId,
          receiverId: targetUserId,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw createError({ statusCode: 409, statusMessage: 'Friendship already exists' });
      }
      throw error;
    }

    const friendship = result[0];
    if (!friendship) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create friendship' });
    }
    notifyFriendsChanged([initiatorId, targetUserId]);
    return friendship;
  },

  async acceptFriendship(db: DBConnection, userId: string, id: string, event: unknown): Promise<Friendship | undefined> {
    const [existing] = await db.select()
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.receiverId, userId)));

    if (!existing) {
      return undefined;
    }

    if (await this.hasBlockBetween(db, existing.initiatorId, existing.receiverId)) {
      throw createError({ statusCode: 403, statusMessage: 'Friendship unavailable' });
    }

    const result = await db.update(friendshipsTable)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.receiverId, userId)))
      .returning();

    const friendship = result[0];
    if (friendship) {
      notifyFriendsChanged([friendship.initiatorId, friendship.receiverId]);
    }
    return friendship;
  },

  async cleanupFriendshipData(db: DBConnection, u1: string, u2: string): Promise<void> {

    // Cleanup sharing flags
    await db.update(habits)
      .set({ sharedWith: sql`array_remove(shared_with, ${u2})` })
      .where(eq(habits.ownerId, u1));
    
    await db.update(habits)
      .set({ sharedWith: sql`array_remove(shared_with, ${u1})` })
      .where(eq(habits.ownerId, u2));
    
    await db.update(habitLogs)
      .set({ sharedWith: sql`array_remove(shared_with, ${u2})` })
      .where(eq(habitLogs.ownerId, u1));
    
    await db.update(habitLogs)
      .set({ sharedWith: sql`array_remove(shared_with, ${u1})` })
      .where(eq(habitLogs.ownerId, u2));
  },

  async removeFriendship(db: DBConnection, userId: string, id: string, event: unknown): Promise<boolean> {
    const friendshipsRes = await db.select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, id));
    
    const friendship = friendshipsRes[0];
    if (!friendship) return false;
    
    // Authorization Check
    if (friendship.initiatorId !== userId && friendship.receiverId !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }

    const u1 = friendship.initiatorId;
    const u2 = friendship.receiverId;

    // Use transaction for atomic cleanup and deletion
    await db.transaction(async (tx) => {
      await this.cleanupFriendshipData(tx, u1, u2);
      await tx.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
    });

    notifyFriendsChanged([u1, u2]);
    return true;
  }
};
