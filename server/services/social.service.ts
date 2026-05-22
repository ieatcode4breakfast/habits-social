import { eq, and, or, sql } from 'drizzle-orm';
import { friendships as friendshipsTable, habits, habitLogs } from '~~/server/db/schema';
import { extractRows } from '~~/server/utils/db';
import { reevaluateMultipleBuckets } from '~~/server/utils/buckets';
import type { DBConnection } from '~~/server/types/db';
import type { Friendship } from '~~/server/types';
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

export const SocialService = {
  async createFriendship(db: DBConnection, initiatorId: string, targetUserId: string, event: unknown): Promise<Friendship> {
    if (initiatorId === targetUserId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot friend yourself' });
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
    // Cascade 'removed' status for cross-owned bucket habits
    const affected = await db.execute(sql`
      UPDATE bucket_habits bh
      SET approval_status = 'removed'
      FROM buckets b, habits h
      WHERE bh.bucket_id = b.id AND bh.habit_id = h.id
        AND (
          (h.owner_id = ${u1} AND b.owner_id = ${u2})
          OR (h.owner_id = ${u2} AND b.owner_id = ${u1})
        )
        AND bh.approval_status != 'removed'
      RETURNING bh.bucket_id, b.owner_id
    `);

    const rows = extractRows<{ bucket_id: string, owner_id: string }>(affected);
    if (rows.length > 0) {
      await reevaluateMultipleBuckets(db, rows.map(r => ({ bucketId: r.bucket_id, ownerId: r.owner_id })));
    }

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
