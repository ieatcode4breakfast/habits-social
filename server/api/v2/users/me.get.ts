import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const sql = useDB(event);

  const users = await sql`SELECT id, email, username, photourl, "emailVerifiedAt", "createdAt", "updatedAt" FROM users WHERE id = ${userId}::uuid`;
  
  if (users.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: users[0] };
});
