import { useDB } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const users = await sql`SELECT id, email, username, photourl, "createdAt" FROM users WHERE id = ${userId}::uuid`;
  
  if (users.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: users[0] };
});
