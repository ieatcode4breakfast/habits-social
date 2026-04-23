import { Habit, HabitLog } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const { friendId } = getQuery(event);

  const habits = await Habit.find({ ownerid: String(friendId), sharedwith: userId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  const habitIds = habits.map((h: any) => h._id);
  const logs = await HabitLog.find({ ownerid: String(friendId), habitid: { $in: habitIds } }).lean();

  return {
    habits: habits.map((h: any) => ({ ...h, id: h._id.toString() })),
    logs: logs.map((l: any) => ({ ...l, id: l._id.toString(), habitid: l.habitid.toString() }))
  };
});
