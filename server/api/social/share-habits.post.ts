import { Habit } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  const targetId = String(targetUserId);

  if (habitIds.length > 0) {
    await Habit.updateMany(
      { _id: { $in: habitIds }, ownerid: userId },
      { $addToSet: { sharedwith: targetId } }
    );
  }

  return { success: true };
});
