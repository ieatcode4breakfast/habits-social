import { useDB as _useDB } from '../utils/db';
import { requireAuth as _requireAuth } from '../utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const sql = useDB(event);

  // Execute DB delete
  // Note: Due to foreign key constraints, you might need cascading deletes
  // configured in your DB, or you may need to delete related data here first.
  const result = await sql`
    DELETE FROM users 
    WHERE id = ${userId}::uuid
    RETURNING id
  `;

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { message: 'User deleted successfully', data: result[0] };
});
