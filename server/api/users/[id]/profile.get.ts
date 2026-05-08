import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const results = await db.select({
    id: users.id,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(users)
  .where(eq(users.id, id));

  const profile = results[0];

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: profile };
});

