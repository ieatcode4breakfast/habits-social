import { users } from '../../models';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);

  const user = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photourl: users.photourl
  })
  .from(users)
  .where(eq(users.id, userId))
  .get();

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { user };
});
