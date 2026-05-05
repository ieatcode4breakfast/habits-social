import { useDB as _useDB } from '../../_utils/db';
import { requireAuth as _requireAuth } from '../../_utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const [profile] = await sql`
    SELECT id, username, email, photourl FROM users WHERE id = ${id}::uuid
  `;

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { data: profile };
});
