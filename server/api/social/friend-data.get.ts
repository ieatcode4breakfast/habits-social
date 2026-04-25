import type { IHabit, IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = String(friendId);

  const sharedHabits = await db.collection<IHabit>('habits')
    .find({
      ownerid: fId,
      sharedwith: userId
    })
    .sort({ sortOrder: 1 })
    .toArray();

  const friendHabits = sharedHabits.map((h: any) => ({
    ...h,
    id: h._id.toString()
  }));
  
  const habitIds = friendHabits.map((h: any) => h.id);

  let logs: any[] = [];
  if (habitIds.length > 0) {
    const rawLogs = await db.collection<IHabitLog>('habitlogs')
      .find({
        ownerid: fId,
        habitid: { $in: habitIds }
      })
      .toArray();
    
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
