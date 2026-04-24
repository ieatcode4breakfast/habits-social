import { habitShares } from '../../models';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  const targetId = Number(targetUserId);

  if (habitIds.length > 0) {
    await db.transaction(async (tx: any) => {
      for (const hId of habitIds) {
        // Use insert ignore or check existence
        await tx.insert(habitShares).values({
          habitId: Number(hId),
          userId: targetId,
        }).onConflictDoNothing();
      }
    });
  }

  return { success: true };
});
