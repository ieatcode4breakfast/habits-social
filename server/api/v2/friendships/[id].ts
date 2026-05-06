import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { reevaluateBucketLogs } from '../_utils/buckets';

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
      SET status = 'accepted', "updatedAt" = NOW()
      WHERE id = ${id}::uuid
        AND "receiverId" = ${userId}
      RETURNING id, "initiatorId", "receiverId", status, "initiatorFavorite", "receiverFavorite", "createdAt", "updatedAt"
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
    }

    return { data: result[0] };
  }

  if (event.method === 'DELETE') {
    const friendshipsList = await sql`
      SELECT id, "initiatorId", "receiverId", status FROM friendships WHERE id = ${id}::uuid
    `;
    if (friendshipsList.length > 0) {
      const friendship = friendshipsList[0];
      const isParticipant = String(friendship.initiatorId) === String(userId) || String(friendship.receiverId) === String(userId);
      if (!isParticipant) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
      }

      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      // Cascade 'removed' status for cross-owned bucket habits BEFORE removing sharing flags
      const affected = await sql`
        UPDATE bucket_habits bh
        SET approval_status = 'removed'
        FROM buckets b, habits h
        WHERE bh.bucket_id = b.id AND bh.habit_id = h.id
          AND (
            (h.ownerid = ${u1}::uuid AND b.ownerid = ${u2}::uuid)
            OR (h.ownerid = ${u2}::uuid AND b.ownerid = ${u1}::uuid)
          )
          AND bh.approval_status != 'removed'
        RETURNING bh.bucket_id, b.ownerid
      `;

      for (const row of affected) {
        await reevaluateBucketLogs(sql, row.bucket_id, row.ownerid);
      }

      await sql`UPDATE habits SET sharedwith = array_remove(sharedwith, ${u2}) WHERE ownerid = ${u1}`;
      await sql`UPDATE habits SET sharedwith = array_remove(sharedwith, ${u1}) WHERE ownerid = ${u2}`;
      await sql`UPDATE habitlogs SET sharedwith = array_remove(sharedwith, ${u2}) WHERE ownerid = ${u1}`;
      await sql`UPDATE habitlogs SET sharedwith = array_remove(sharedwith, ${u1}) WHERE ownerid = ${u2}`;

      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    } else {
      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    }

    return { data: { success: true } };
  }
});
