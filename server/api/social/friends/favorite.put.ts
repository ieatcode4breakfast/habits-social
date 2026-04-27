import { useDB } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { friendshipId, favorite } = await readBody(event);

  if (!friendshipId) {
    throw createError({ statusCode: 400, statusMessage: 'Friendship ID is required' });
  }

  // Find the friendship to see if user is initiator or receiver
  const [friendship] = await sql`SELECT * FROM friendships WHERE id = ${friendshipId}::uuid`;
  
  if (!friendship) {
    throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
  }

  const isInitiator = String(friendship.initiatorId) === String(userId);
  const isReceiver = String(friendship.receiverId) === String(userId);

  if (!isInitiator && !isReceiver) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized' });
  }

  let result;
  if (isInitiator) {
    result = await sql`
      UPDATE friendships 
      SET "initiatorFavorite" = ${favorite}, "updatedAt" = NOW()
      WHERE id = ${friendshipId}::uuid
      RETURNING *
    `;
  } else {
    result = await sql`
      UPDATE friendships 
      SET "receiverFavorite" = ${favorite}, "updatedAt" = NOW()
      WHERE id = ${friendshipId}::uuid
      RETURNING *
    `;
  }

  const updated = result[0];
  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update favorite status' });
  }

  return {
    ...updated,
    id: updated.id,
    participants: [updated.initiatorId, updated.receiverId]
  };
});
