import { users } from '../../models';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  requireAuth(event);
  const { friendId } = getQuery(event);
  
  const user = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    photourl: users.photourl,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, Number(friendId))).get();
  
  if (!user) throw createError({ statusCode: 404 });
  return user;
});
