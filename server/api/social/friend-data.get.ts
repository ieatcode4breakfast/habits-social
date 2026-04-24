import { habits, habitLogs, habitShares } from '../../models';
import { eq, and, inArray, asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = Number(friendId);

  // Find habits owned by friend and shared with user
  const sharedHabits = await db.select({
    habit: habits
  })
  .from(habits)
  .innerJoin(habitShares, eq(habitShares.habitId, habits.id))
  .where(and(
    eq(habits.ownerId, fId),
    eq(habitShares.userId, userId)
  ))
  .orderBy(asc(habits.sortOrder));

  const friendHabits = sharedHabits.map((h: any) => h.habit);
  const habitIds = friendHabits.map((h: any) => h.id);

  let logs: any[] = [];
  if (habitIds.length > 0) {
    logs = await db.select().from(habitLogs).where(and(
      eq(habitLogs.ownerId, fId),
      inArray(habitLogs.habitId, habitIds)
    ));
  }

  return {
    habits: friendHabits,
    logs: logs
  };
});
