import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeUser } from '../_utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const sql = useDB(event);

  const users = await sql`SELECT id, email, username, photo_url, email_verified_at, created_at, updated_at FROM users WHERE id = ${userId}::uuid`;
  
  if ((users as any[]).length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: normalizeUser((users as any[])[0]) };
});
