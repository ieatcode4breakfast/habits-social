import { eq } from 'drizzle-orm';
import { friendships } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { favoriteSchema } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const validation = favoriteSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { friendshipId, favorite } = validation.data;

  const results = await db.select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId));
  
  if (results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Friendship not found' });
  }

  const friendship = results[0];
  const isInitiator = String(friendship.initiatorId) === String(userId);
  const isReceiver = String(friendship.receiverId) === String(userId);

  if (!isInitiator && !isReceiver) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized' });
  }

  let result;
  if (isInitiator) {
    result = await db.update(friendships)
      .set({ initiatorFavorite: favorite, updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId))
      .returning();
  } else {
    result = await db.update(friendships)
      .set({ receiverFavorite: favorite, updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId))
      .returning();
  }

  return { data: result[0] };
});

