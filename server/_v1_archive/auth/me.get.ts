import { normalizeUser } from '../_utils/normalize';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await getUserFromEvent(event);

  if (!userId) {
    return { user: null };
  }

  const users = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  const user = (users as any[])[0];

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { 
    user: normalizeUser(user)
  };
});

