import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);

  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl,
    emailVerifiedAt: users.emailVerifiedAt,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt
  })
    .from(users)
    .where(eq(users.id, userId));
  
  if (results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: results[0] };
});

