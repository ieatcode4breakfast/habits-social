import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { friendshipCreateSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');

    const userFriendships = await sql`
      SELECT id, initiator_id, receiver_id, status, initiator_favorite, receiver_favorite, created_at, updated_at FROM friendships 
      WHERE initiator_id = ${userId} OR receiver_id = ${userId}
    `;

    const friendIds = (userFriendships as any[]).map((f: any) =>
      String(f.initiator_id) === String(userId) ? f.receiver_id : f.initiator_id
    );

    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await sql`
        SELECT id, username, photo_url FROM users 
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
      WHERE (initiator_id = ${userId} AND receiver_id = ${targetUserId})
         OR (initiator_id = ${targetUserId} AND receiver_id = ${userId})
    `;

    if ((existing as any[]).length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Friendship already exists' });
    }

    const result = await sql`
      INSERT INTO friendships (initiator_id, receiver_id, status, created_at, updated_at)
      VALUES (${userId}, ${targetUserId}, 'pending', NOW(), NOW())
      RETURNING id, initiator_id, receiver_id, status, initiator_favorite, receiver_favorite, created_at, updated_at
    `;

    if (!(result as any[])[0]) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create friendship' });
    }

    return { data: (result as any[])[0] };
  }
});
