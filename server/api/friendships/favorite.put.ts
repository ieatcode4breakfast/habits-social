import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { favoriteSchema } from '../../utils/validation';

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

  const [friendship] = await sql`SELECT id, initiator_id, receiver_id FROM friendships WHERE id = ${friendshipId}::uuid`;
  if (!friendship) {
    throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
  }

  const isInitiator = String((friendship as any).initiator_id) === String(userId);
  const isReceiver = String((friendship as any).receiver_id) === String(userId);

  if (!isInitiator && !isReceiver) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized' });
  }

  let result;
  if (isInitiator) {
    result = await sql`
      UPDATE friendships 
      SET initiator_favorite = ${favorite}, updated_at = NOW()
      WHERE id = ${friendshipId}::uuid
      RETURNING id, initiator_id, receiver_id, status, initiator_favorite, receiver_favorite, created_at, updated_at
    `;
  } else {
    result = await sql`
      UPDATE friendships 
      SET receiver_favorite = ${favorite}, updated_at = NOW()
      WHERE id = ${friendshipId}::uuid
      RETURNING id, initiator_id, receiver_id, status, initiator_favorite, receiver_favorite, created_at, updated_at
    `;
  }

  return { data: (result as any[])[0] };
});
