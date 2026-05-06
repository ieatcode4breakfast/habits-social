import { useDB as _useDB } from '../_utils/db';
import { getUserFromEvent as _getUserFromEvent } from '../_utils/auth';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const getUserFromEvent = (event.context as any).getUserFromEvent || _getUserFromEvent;
  const sql = useDB(event);

  const userId = await getUserFromEvent(event);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const users = await sql`SELECT id, email, username, photourl FROM users WHERE id = ${userId}::uuid`;
  const user = users[0];

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: user };
});
