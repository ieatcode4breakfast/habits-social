import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const { username } = getQuery(event);
  if (!username) return { data: [] };

  const results = await sql`
    SELECT id, username, email, photourl FROM users 
    WHERE username ILIKE ${'%' + String(username) + '%'} 
      AND id != ${userId}::uuid
    LIMIT 25
  `;

  return { data: results };
});
