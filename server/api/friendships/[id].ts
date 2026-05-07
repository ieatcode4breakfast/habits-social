import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { reevaluateBucketLogs } from '../../utils/buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  if (event.method === 'PUT') {
    const result = await sql`
      UPDATE friendships 
      SET status = 'accepted', updated_at = NOW()
      WHERE id = ${id}::uuid
        AND receiver_id = ${userId}
      RETURNING id, initiator_id, receiver_id, status, initiator_favorite, receiver_favorite, created_at, updated_at
    `;

    if ((result as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
    }

    return { data: (result as any[])[0] };
  }

  if (event.method === 'DELETE') {
    const friendshipsList = await sql`
      SELECT id, initiator_id, receiver_id, status FROM friendships WHERE id = ${id}::uuid
    `;
    if ((friendshipsList as any[]).length > 0) {
      const friendship = (friendshipsList as any[])[0];
      const isParticipant = String(friendship.initiator_id) === String(userId) || String(friendship.receiver_id) === String(userId);
      if (!isParticipant) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
      }

      const u1 = friendship.initiator_id;
      const u2 = friendship.receiver_id;

      // Cascade 'removed' status for cross-owned bucket habits BEFORE removing sharing flags
      const affected = await sql`
        UPDATE bucket_habits bh
        SET approval_status = 'removed'
        FROM buckets b, habits h
        WHERE bh.bucket_id = b.id AND bh.habit_id = h.id
          AND (
            (h.owner_id = ${u1}::uuid AND b.owner_id = ${u2}::uuid)
            OR (h.owner_id = ${u2}::uuid AND b.owner_id = ${u1}::uuid)
          )
          AND bh.approval_status != 'removed'
        RETURNING bh.bucket_id, b.owner_id
      `;

      for (const row of (affected as any[])) {
        await reevaluateBucketLogs(sql, row.bucket_id, row.owner_id);
      }

      await sql`UPDATE habits SET shared_with = array_remove(shared_with, ${u2}) WHERE owner_id = ${u1}`;
      await sql`UPDATE habits SET shared_with = array_remove(shared_with, ${u1}) WHERE owner_id = ${u2}`;
      await sql`UPDATE habit_logs SET shared_with = array_remove(shared_with, ${u2}) WHERE owner_id = ${u1}`;
      await sql`UPDATE habit_logs SET shared_with = array_remove(shared_with, ${u1}) WHERE owner_id = ${u2}`;

      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    } else {
      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    }

    return { data: { success: true } };
  }
});
