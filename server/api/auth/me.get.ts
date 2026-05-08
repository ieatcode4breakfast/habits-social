import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { getUserFromEvent as _getUserFromEvent } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const getUserFromEvent = (event.context as any).getUserFromEvent || _getUserFromEvent;
  const db = useDB(event);

  const userId = await getUserFromEvent(event);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(users)
  .where(eq(users.id, userId));

  const user = results[0];

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: user };
});

