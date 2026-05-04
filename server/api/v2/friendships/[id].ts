import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';

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
        AND ("initiatorId" = ${userId} OR "receiverId" = ${userId})
      RETURNING *
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
    }

    return { data: result[0] };
  }

  if (event.method === 'DELETE') {
    const friendshipsList = await sql`
      SELECT * FROM friendships WHERE id = ${id}::uuid
    `;
    if (friendshipsList.length > 0) {
      const friendship = friendshipsList[0];
      const isParticipant = String(friendship.initiatorId) === String(userId) || String(friendship.receiverId) === String(userId);
      if (!isParticipant) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
      }
    }

    await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    return { data: { success: true } };
  }
});
