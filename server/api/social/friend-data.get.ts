import { Habit, HabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = String(friendId);

  const sharedHabits = await Habit.find({
    ownerid: fId,
    sharedwith: userId
  })
  .sort({ sortOrder: 1 })
  .lean();

  const friendHabits = sharedHabits.map((h: any) => ({
    ...h,
    id: h._id.toString()
  }));
  
  const habitIds = friendHabits.map((h: any) => h.id);

  let logs: any[] = [];
  if (habitIds.length > 0) {
    const rawLogs = await HabitLog.find({
      ownerid: fId,
      habitid: { $in: habitIds }
    }).lean();
    
    logs = rawLogs.map((l: any) => ({
      ...l,
      id: l._id.toString()
    }));
  }

  return {
    habits: friendHabits,
    logs: logs
  };
});
