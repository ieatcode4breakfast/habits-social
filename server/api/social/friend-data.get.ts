import { Habit, HabitLog } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const query = getQuery(event);
  const friendId = query.friendId ? String(query.friendId) : null;
  const type = query.type ? String(query.type) : 'habits';

  if (!friendId) {
    return [];
  }

  // Get habits/logs where owner is friendId and sharedwith contains userId
  if (type === 'habits') {
    const habits = await Habit.find({ ownerid: friendId, sharedwith: userId }).lean();
    return habits.map((h: any) => ({ ...h, id: h._id.toString() }));
  } else {
    // habit logs
    const logs = await HabitLog.find({ ownerid: friendId, sharedwith: userId }).lean();
    return logs.map((l: any) => ({ ...l, id: l._id.toString() }));
  }
});
