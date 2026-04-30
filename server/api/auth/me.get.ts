import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await getUserFromEvent(event);

  if (!userId) {
    return { user: null };
  }

  const users = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  const user = users[0] as IUser | undefined;

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { 
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      photourl: user.photourl
    } 
  };
});
