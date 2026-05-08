import { eq, and, or, sql } from 'drizzle-orm';
import { friendships, bucketHabits, buckets, habits, habitLogs } from '~~/server/db/schema';
import { useDB as _useDB, extractRows } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { reevaluateBucketLogs } from '~~/server/utils/buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  if (event.method === 'PUT') {
    const result = await db.update(friendships)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(and(eq(friendships.id, id), eq(friendships.receiverId, userId)))
      .returning();

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
    }

    return { data: result[0] };
  }

  if (event.method === 'DELETE') {
    const friendshipsRes = await db.select()
      .from(friendships)
      .where(eq(friendships.id, id));
    
    if (friendshipsRes.length > 0) {
      const friendship = friendshipsRes[0];
      const isParticipant = String(friendship.initiatorId) === String(userId) || String(friendship.receiverId) === String(userId);
      if (!isParticipant) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
      }

      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      // Cascade 'removed' status for cross-owned bucket habits BEFORE removing sharing flags
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
      for (const row of rows) {
        await reevaluateBucketLogs(db, row.bucket_id, row.owner_id);
      }

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

      await db.delete(friendships).where(eq(friendships.id, id));
    } else {
      await db.delete(friendships).where(eq(friendships.id, id));
    }

    return { data: { success: true } };
  }
});
