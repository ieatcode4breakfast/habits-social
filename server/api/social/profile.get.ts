import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  await requireAuth(event);
  const { friendId } = getQuery(event);
  
  const users = await sql`
    SELECT id, email, username, photourl FROM users 
    WHERE id = ${String(friendId)}::uuid
  `;
  
  if (users.length === 0) throw createError({ statusCode: 404 });
  const user = users[0];
  if (!user) throw createError({ statusCode: 404 });
  return { ...user, id: user.id };
});
