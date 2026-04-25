import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];

  const results = await sql`
    SELECT id, username, email, photourl FROM users 
    WHERE username ILIKE ${'%' + String(username) + '%'} 
      AND id != ${userId}::uuid
    LIMIT 25
  `;

  return results.map((u: any) => ({
    ...u,
    id: u.id
  }));
});
