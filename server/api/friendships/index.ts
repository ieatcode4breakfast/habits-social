import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { friendships as friendshipsTable, users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { friendshipCreateSchema } from '~~/server/utils/validation';

import { SocialService } from '~~/server/services/social.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');

    const userFriendships = await db.select()
      .from(friendshipsTable)
      .where(or(eq(friendshipsTable.initiatorId, userId), eq(friendshipsTable.receiverId, userId)));

    const friendIds = userFriendships.map((f: any) =>
      String(f.initiatorId) === String(userId) ? f.receiverId : f.initiatorId
    );

    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await db.select({
        id: users.id,
        username: users.username,
        photoUrl: users.photoUrl
      })
      .from(users)
      .where(inArray(users.id, friendIds));
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

    const targetRes = await db.select({ username: users.username })
      .from(users)
      .where(eq(users.id, targetUserId));
    
    if (targetRes.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Target user not found' });
    }

    const existing = await db.select({ id: friendshipsTable.id })
      .from(friendshipsTable)
      .where(or(
        and(eq(friendshipsTable.initiatorId, userId), eq(friendshipsTable.receiverId, targetUserId)),
        and(eq(friendshipsTable.initiatorId, targetUserId), eq(friendshipsTable.receiverId, userId))
      ));

    if (existing.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Friendship already exists' });
    }

    const result = await SocialService.createFriendship(db, userId, targetUserId, event);

    if (!result) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create friendship' });
    }

    return { data: result };
  }
});
