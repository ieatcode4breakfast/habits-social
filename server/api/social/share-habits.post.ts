import { Habit } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  const { targetUserId, habitIds } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  if (habitIds.length > 0) {
    await Habit.updateMany(
      { _id: { $in: habitIds }, ownerid: userId },
      { $addToSet: { sharedwith: targetUserId } }
    );
  }

  return { success: true };
});
