import { Habit } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    const habits = await Habit.find({ ownerid: userId }).lean();
    return habits.map((h: any) => ({ ...h, id: h._id.toString() }));
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habit = await Habit.create({
      ownerid: userId,
      title: body.title,
      description: body.description || '',
      color: body.color || '#6366f1',
      sharedwith: body.sharedwith || []
    });
    return { ...habit.toObject(), id: habit._id.toString() };
  }
});
