import { eq, and } from 'drizzle-orm';
import { habits } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { reorderSchema } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const validation = reorderSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { ids } = validation.data;
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] as string;
      await db.update(habits)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(habits.id, id), eq(habits.ownerId, userId)));
    }
  }


  return { data: { success: true } };
});

