import { users } from '../../models';
import { eq, ne, and, like } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];

  const results = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    photourl: users.photourl,
  }).from(users)
    .where(and(
      like(users.username, `%${username}%`),
      ne(users.id, userId)
    ));

  return results;
});
