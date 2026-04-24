import { habits } from '../../models';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(habits)
        .set({ sortOrder: i })
        .where(and(eq(habits.id, Number(ids[i])), eq(habits.ownerId, userId)));
    }
  });

  return { success: true };
});
