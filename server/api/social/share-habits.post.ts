import type { IHabit } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  const targetId = String(targetUserId);

  // Update each habit individually to avoid Neon HTTP driver array param issues
  for (const rawId of habitIds) {
    const habitId = String(rawId);
    await sql`
      UPDATE habits 
      SET sharedwith = array_append(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ${habitId}::uuid
        AND ownerid = ${userId}
        AND NOT (${targetId} = ANY(sharedwith))
    `;
  }

  return { success: true };
});
