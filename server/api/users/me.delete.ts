import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);

  // Execute DB delete
  // Note: Due to foreign key constraints, you might need cascading deletes
  // configured in your DB, or you may need to delete related data here first.
  const result = await db.delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { message: 'User deleted successfully', data: result[0] };
});

