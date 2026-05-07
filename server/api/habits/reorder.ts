import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { reorderSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = reorderSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { ids } = validation.data;
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i++) {
      await sql`UPDATE habits SET sort_order = ${i}, updated_at = NOW() WHERE id = ${ids[i]}::uuid AND owner_id = ${userId}`;
    }
  }

  return { data: { success: true } };
});
