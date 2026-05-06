import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { favoriteSchema } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = favoriteSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { friendshipId, favorite } = validation.data;

  const [friendship] = await sql`SELECT id, "initiatorId", "receiverId" FROM friendships WHERE id = ${friendshipId}::uuid`;
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
      RETURNING id, "initiatorId", "receiverId", status, "initiatorFavorite", "receiverFavorite", "createdAt", "updatedAt"
    `;
  } else {
    result = await sql`
      UPDATE friendships 
      SET "receiverFavorite" = ${favorite}, "updatedAt" = NOW()
      WHERE id = ${friendshipId}::uuid
      RETURNING id, "initiatorId", "receiverId", status, "initiatorFavorite", "receiverFavorite", "createdAt", "updatedAt"
    `;
  }

  return { data: result[0] };
});
