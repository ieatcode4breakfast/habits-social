import { and, eq, sql } from 'drizzle-orm';
import { userBlocks, users } from '~~/server/db/schema';
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
    eq(users.id, id),
    sql`NOT EXISTS (
      SELECT 1
      FROM ${userBlocks}
      WHERE ${userBlocks.blockerId} = ${users.id}
        AND ${userBlocks.blockedId} = ${userId}::uuid
    )`
  ));

  const profile = results[0];

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: profile };
});
