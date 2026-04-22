import { Habit, HabitLog } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const habitId = getRouterParam(event, 'id');

  if (!habitId) {
    throw createError({ statusCode: 400, statusMessage: 'Habit ID required' });
  }

  const habit = await Habit.findOne({ _id: habitId, ownerid: userId });
  if (!habit) {
    throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    habit.title = body.title || habit.title;
    habit.description = body.description || habit.description;
    habit.color = body.color || habit.color;
    habit.sharedwith = body.sharedwith || habit.sharedwith;
    habit.updatedat = new Date();
    await habit.save();
    return { success: true };
  }

  if (event.method === 'DELETE') {
    await Habit.deleteOne({ _id: habitId });
    await HabitLog.deleteMany({ habitid: habitId });
    return { success: true };
  }
});
