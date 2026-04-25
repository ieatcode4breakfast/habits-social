import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  await requireAuth(event);
  const { friendId } = getQuery(event);

  if (!friendId || typeof friendId !== 'string' || friendId === 'undefined') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid friendId provided'
    });
  }
  
  const users = await sql`
    SELECT id, username, email, avatar_url, bio 
    FROM users 
    WHERE id = ${friendId}::uuid
  `;
  
  if (users.length === 0) throw createError({ statusCode: 404 });
  const user = users[0];
  if (!user) throw createError({ statusCode: 404 });
  return { ...user, id: user.id };
});
