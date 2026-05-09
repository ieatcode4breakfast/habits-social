import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, lt, gte, desc, asc, sql } from 'drizzle-orm';
import { habits, habitLogs } from '../db/schema';
import { calculateStreakFromLogs } from '../../utils/habits';

export async function recalculateHabitStreak(db: any, habitId: string, userId: string, fromDate?: string) {
  if (!habitId || habitId.length < 36) return;
  // 1. Fetch habit info
  const habitRes = await db.select({
    longestStreak: habits.longestStreak,
    streakAnchorDate: habits.streakAnchorDate
  })
  .from(habits)
  .where(eq(habits.id, habitId));

  if (!habitRes || habitRes.length === 0) return;
  const habit = habitRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;
  let maxStreak = 0;

  // 2. If incremental, find the starting point state from the log just before fromDate
  if (fromDate) {
    const prevLogRes = await db.select({
      streakCount: habitLogs.streakCount,
      date: habitLogs.date
    })
    .from(habitLogs)
    .where(sql`${habitLogs.habitId} = ${habitId} AND ${habitLogs.ownerId} = ${userId} AND ${habitLogs.date} < ${fromDate}`)
    .orderBy(desc(habitLogs.date))
    .limit(1);

    if (prevLogRes && prevLogRes.length > 0) {
      const prevLog = prevLogRes[0];
      runningStreak = prevLog.streakCount;
      lastDate = startOfDay(parseISO(prevLog.date));
    }

    const maxRes = await db.select({
      maxStreak: sql`MAX(${habitLogs.streakCount})`
    })
    .from(habitLogs)
    .where(sql`${habitLogs.habitId} = ${habitId} AND ${habitLogs.ownerId} = ${userId} AND ${habitLogs.date} < ${fromDate}`);

    maxStreak = Number(maxRes[0]?.maxStreak || 0);
  }

  // 3. Fetch logs from starting point onwards
  const logsQuery = db.select()
    .from(habitLogs)
    .where(sql`${habitLogs.habitId} = ${habitId} AND ${habitLogs.ownerId} = ${userId}`);

  if (queryStartDate) {
    logsQuery.where(sql`${habitLogs.habitId} = ${habitId} AND ${habitLogs.ownerId} = ${userId} AND ${habitLogs.date} >= ${queryStartDate}`);
  }
  
  const rawLogs = await logsQuery.orderBy(asc(habitLogs.date));

  if (!rawLogs || rawLogs.length === 0) {
    // If we're doing a full rebuild and no logs, reset habit.
    if (!fromDate) {
      const result = await db.update(habits)
        .set({
          currentStreak: 0,
          streakAnchorDate: null,
          updatedAt: new Date()
        })
        .where(eq(habits.id, habitId))
        .returning();
      return result[0];
    }

    const result = await db.update(habits)
      .set({
        currentStreak: runningStreak,
        updatedAt: new Date()
      })
      .where(eq(habits.id, habitId))
      .returning();
    return result[0];
  }

  // 4. Use shared logic for calculation
  const { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    rawLogs,
    runningStreak,
    lastDate,
    maxStreak,
    habit.streakAnchorDate
  );

  // 5. Update habitlogs
  if (logUpdates.length > 0) {
    for (const update of logUpdates) {
      await db.update(habitLogs)
        .set({
          streakCount: update.streakCount,
          brokenStreakCount: update.brokenStreakCount,
          updatedAt: new Date()
        })
        .where(eq(habitLogs.id, update.id));
    }
  }

  // 6. Final Habit Update: Set current and longest streak
  const result = await db.update(habits)
    .set({
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: new Date()
    })
    .where(eq(habits.id, habitId))
    .returning();

  return result[0];
}


