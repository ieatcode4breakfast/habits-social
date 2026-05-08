import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeUser } from '~~/server/utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);

  const results = await db.select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: normalizeUser(results[0]) };
});

