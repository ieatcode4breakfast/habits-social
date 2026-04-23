import { Habit } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const id = getRouterParam(event, 'id');

  const habit = await Habit.findOne({ _id: id, ownerid: userId });
  if (!habit) throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (event.method === 'PUT') {
    const body = await readBody(event);
    Object.assign(habit, { ...body, updatedat: new Date() });
    await habit.save();
    return { ...habit.toObject(), id: habit._id.toString() };
  }

  if (event.method === 'DELETE') {
    await Habit.deleteOne({ _id: id });
    return { success: true };
  }
});
