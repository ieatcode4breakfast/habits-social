import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { friendshipCreateSchema } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');

    const userFriendships = await sql`
      SELECT id, "initiatorId", "receiverId", status, "initiatorFavorite", "receiverFavorite", "createdAt", "updatedAt" FROM friendships 
      WHERE "initiatorId" = ${userId} OR "receiverId" = ${userId}
    `;

    const friendIds = userFriendships.map((f: any) =>
      String(f.initiatorId) === String(userId) ? f.receiverId : f.initiatorId
    );

    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await sql`
        SELECT id, email, username, photourl FROM users 
        WHERE id = ANY(${friendIds}::uuid[])
      `;
    }

    return {
      data: {
        friendships: userFriendships,
        profiles
      }
    };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = friendshipCreateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const { targetUserId } = validation.data;

    const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'Target user not found' });
    }

    const existing = await sql`
      SELECT 1 FROM friendships 
      WHERE ("initiatorId" = ${userId} AND "receiverId" = ${targetUserId})
         OR ("initiatorId" = ${targetUserId} AND "receiverId" = ${userId})
    `;

    if (existing.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Friendship already exists' });
    }

    const result = await sql`
      INSERT INTO friendships ("initiatorId", "receiverId", status, "createdAt", "updatedAt")
      VALUES (${userId}, ${targetUserId}, 'pending', NOW(), NOW())
      RETURNING id, "initiatorId", "receiverId", status, "initiatorFavorite", "receiverFavorite", "createdAt", "updatedAt"
    `;

    if (!result[0]) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create friendship' });
    }

    return { data: result[0] };
  }
});
