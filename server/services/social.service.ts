import { eq, and, or, sql } from 'drizzle-orm';
import { friendships as friendshipsTable, habits, habitLogs, users } from '~~/server/db/schema';
import { extractRows } from '~~/server/utils/db';
import { reevaluateMultipleBuckets } from '~~/server/utils/buckets';

export const SocialService = {
  async createFriendship(db: any, initiatorId: string, targetUserId: string, event: any) {
    if (initiatorId === targetUserId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot friend yourself' });
    }

    let result;
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
    } catch (err: any) {
      if (err.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Friendship already exists' });
      }
      throw err;
    }

    const friendship = result[0];
    return friendship;
  },

  async acceptFriendship(db: any, userId: string, id: string, event: any) {
    const result = await db.update(friendshipsTable)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.receiverId, userId)))
      .returning();

    const friendship = result[0];
    return friendship;
  },

  async cleanupFriendshipData(db: any, u1: string, u2: string) {
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

  async removeFriendship(db: any, userId: string, id: string, event: any) {
    const friendshipsRes = await db.select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, id));
    
    if (friendshipsRes.length === 0) return false;

    const friendship = friendshipsRes[0];
    
    // Authorization Check
    if (friendship.initiatorId !== userId && friendship.receiverId !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }

    const u1 = friendship.initiatorId;
    const u2 = friendship.receiverId;

    // Use transaction for atomic cleanup and deletion
    await db.transaction(async (tx: any) => {
      await this.cleanupFriendshipData(tx, u1, u2);
      await tx.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
    });

    return true;
  }
};
