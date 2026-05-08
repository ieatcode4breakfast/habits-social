import { ilike, and, ne } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const { username } = getQuery(event);
  if (!username || typeof username !== 'string') return { data: [] };

  const sanitizedUsername = username.slice(0, 100);

  const results = await db.select({
    id: users.id,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(users)
  .where(and(
    ilike(users.username, `%${sanitizedUsername}%`),
    ne(users.id, userId)
  ))
  .limit(25);

  return { data: results };
});

