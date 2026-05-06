import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const { username } = getQuery(event);
  if (!username || typeof username !== 'string') return { data: [] };

  const sanitizedUsername = username.slice(0, 100);

  const results = await sql`
    SELECT id, username, photourl FROM users 
    WHERE username ILIKE ${'%' + sanitizedUsername + '%'} 
      AND id != ${userId}::uuid
    LIMIT 25
  `;

  return { data: results };
});
