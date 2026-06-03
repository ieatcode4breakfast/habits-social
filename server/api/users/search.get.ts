import { ilike, and, ne, sql } from 'drizzle-orm';
import { userBlocks, users } from '~~/server/db/schema';
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
  const safeString = sanitizedUsername.replace(/[%_]/g, '\\$&');

  const results = await db.select({
    id: users.id,
    username: users.username,
    photoUrl: users.photoUrl,
    blockedByMe: sql<boolean>`EXISTS (
      SELECT 1
      FROM ${userBlocks}
      WHERE ${userBlocks.blockerId} = ${userId}::uuid
        AND ${userBlocks.blockedId} = ${users.id}
    )`
  })
  .from(users)
  .where(and(
    ilike(users.username, `%${safeString}%`),
    ne(users.id, userId),
    sql`NOT EXISTS (
      SELECT 1
      FROM ${userBlocks}
      WHERE ${userBlocks.blockerId} = ${users.id}
        AND ${userBlocks.blockedId} = ${userId}::uuid
    )`
  ))
  .limit(25);

  return { data: results };
});
