import { eq, and, sql, inArray } from 'drizzle-orm';
import { habits } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { habitReorderSchema, getZodErrorMessage } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const validation = habitReorderSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: getZodErrorMessage(validation.error), data: validation.error.flatten() });
  }

  const { ids } = validation.data;
  if (ids.length > 0) {
    await db.update(habits)
      .set({
        sortOrder: sql`CASE ${sql.join(
          ids.map((id, index) => sql`WHEN ${habits.id} = ${id} THEN ${index}::integer`),
          sql` `
        )} END`,
        updatedAt: new Date()
      })
      .where(and(
        inArray(habits.id, ids),
        eq(habits.ownerId, userId)
      ));
  }


  return { data: { success: true } };
});

