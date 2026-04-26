import { isDummyUsername, ISOLATION_REGEX } from '../../utils/isolation';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];

  // Get current user to check for dummy status
  const [me] = await sql`SELECT username FROM users WHERE id = ${userId}::uuid`;
  const isDummy = isDummyUsername(me?.username);

  const results = await sql`
    SELECT id, username, email, photourl FROM users 
    WHERE username ILIKE ${'%' + String(username) + '%'} 
      AND id != ${userId}::uuid
      AND (
        (${isDummy}::boolean AND username ~* ${ISOLATION_REGEX})
        OR
        (NOT ${isDummy}::boolean AND username !~* ${ISOLATION_REGEX})
      )
    LIMIT 25
  `;

  return results.map((u: any) => ({
    ...u,
    id: u.id
  }));
});
