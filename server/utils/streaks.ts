import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, lt, gte, desc, asc, sql } from 'drizzle-orm';
import { habits, habitLogs } from '../db/schema';
import { normalizeHabit, normalizeLog } from './normalize';

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

  const logs = rawLogs;

  // 4. The Cascading Update: Iterate through timeline and calculate counts
  let streakAnchorDate: string | null = habit.streakAnchorDate;
  const updates: any[] = [];

  for (const log of logs) {
    const currentDate = startOfDay(parseISO(log.date));

    // Check for gap (more than 1 day between logs)
    if (lastDate) {
      const diff = differenceInDays(currentDate, lastDate);
      if (diff > 1) {
        runningStreak = 0; // Gap detected, reset streak
      }
    }

    let brokenStreakCount = 0;
    if (log.status === 'completed') {
      runningStreak++;
    } else if (log.status === 'failed') {
      brokenStreakCount = runningStreak;
      runningStreak = 0;
    } else if (log.status === 'skipped' || log.status === 'vacation') {
      // Streak remains intact (protected)
    } else if (log.status === 'cleared') {
      runningStreak = 0;
    }

    maxStreak = Math.max(maxStreak, runningStreak);

    // The anchor is the most recent log date with a valid status
    if (['completed', 'failed', 'skipped', 'vacation'].includes(log.status)) {
      streakAnchorDate = log.date;
    }

    if (log.streakCount !== runningStreak || log.brokenStreakCount !== brokenStreakCount) {
      updates.push({
        id: log.id,
        streakCount: runningStreak,
        brokenStreakCount: brokenStreakCount
      });
    }

    lastDate = currentDate;
  }

  // 5. Update habitlogs
  if (updates.length > 0) {
    for (const update of updates) {
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
      currentStreak: runningStreak,
      longestStreak: maxStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: new Date()
    })
    .where(eq(habits.id, habitId))
    .returning();

  return result[0];
}


