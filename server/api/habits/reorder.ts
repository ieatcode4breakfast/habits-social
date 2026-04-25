import type { IHabit } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  if (ids.length > 0) {
    await sql.transaction(ids.map((id, index) => 
      sql`UPDATE habits SET "sortOrder" = ${index} WHERE id = ${id}::uuid AND ownerid = ${userId}`
    ));
  }

  return { success: true };
});
