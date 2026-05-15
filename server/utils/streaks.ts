import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, ne, lt, gte, desc, asc, sql, and } from 'drizzle-orm';
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
  .where(and(eq(habits.id, habitId), eq(habits.ownerId, userId)));

  if (!habitRes || habitRes.length === 0) return;
  const habit = habitRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;
  let maxStreak = 0;
  let baselineAnchor: string | null = habit.streakAnchorDate;

  // 2. If incremental, find the starting point state from the log just before fromDate
  if (fromDate) {
    const prevLogRes = await db.select({
      streakCount: habitLogs.streakCount,
      date: habitLogs.date
    })
    .from(habitLogs)
    .where(and(
      eq(habitLogs.habitId, habitId),
      eq(habitLogs.ownerId, userId),
      lt(habitLogs.date, fromDate),
      ne(habitLogs.status, 'cleared')
    ))
    .orderBy(desc(habitLogs.date))
    .limit(1);

    if (prevLogRes && prevLogRes.length > 0) {
      const prevLog = prevLogRes[0];
      runningStreak = prevLog.streakCount;
      lastDate = startOfDay(parseISO(prevLog.date));
      baselineAnchor = prevLog.date;
    }

    const maxRes = await db.select({
      maxStreak: sql`MAX(${habitLogs.streakCount})`
    })
    .from(habitLogs)
    .where(and(
      eq(habitLogs.habitId, habitId),
      eq(habitLogs.ownerId, userId),
      lt(habitLogs.date, fromDate),
      ne(habitLogs.status, 'cleared')
    ));

    maxStreak = Number(maxRes[0]?.maxStreak || 0);
  }

  // 3. Fetch logs from starting point onwards
  const conditions = [
    eq(habitLogs.habitId, habitId),
    eq(habitLogs.ownerId, userId)
  ];

  if (queryStartDate) {
    conditions.push(gte(habitLogs.date, queryStartDate));
  }

  const rawLogs = await db.select()
    .from(habitLogs)
    .where(and(...conditions))
    .orderBy(asc(habitLogs.date));

  if (!rawLogs || rawLogs.length === 0) {
    // If we're doing a full rebuild and no logs, reset habit.
    if (!fromDate) {
      const result = await db.update(habits)
        .set({
          currentStreak: 0,
          streakAnchorDate: null,
          updatedAt: new Date()
        })
        .where(and(eq(habits.id, habitId), eq(habits.ownerId, userId)))
        .returning();
      return result[0];
    }

    const result = await db.update(habits)
      .set({
        currentStreak: runningStreak,
        streakAnchorDate: baselineAnchor,
        updatedAt: new Date()
      })
      .where(and(eq(habits.id, habitId), eq(habits.ownerId, userId)))
      .returning();
    return result[0];
  }

  // 4. Use shared logic for calculation
  let { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    rawLogs,
    runningStreak,
    lastDate,
    maxStreak,
    baselineAnchor
  );

  // 5. Update habitlogs in batch
  if (logUpdates.length > 0) {
    const sqlValues = logUpdates.map(u => sql`(${u.id}::text, ${u.streakCount}::integer, ${u.brokenStreakCount}::integer)`);
    const valuesList = sql.join(sqlValues, sql`, `);
    
    await db.execute(sql`
      UPDATE habit_logs AS hl
      SET 
        streak_count = v.streak_count,
        broken_streak_count = v.broken_streak_count,
        updated_at = NOW()
      FROM (VALUES ${valuesList}) AS v(id, streak_count, broken_streak_count)
      WHERE hl.id = v.id
    `);
  }

  // 6. Final Habit Update: Set current and longest streak
  const result = await db.update(habits)
    .set({
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: new Date()
    })
    .where(and(eq(habits.id, habitId), eq(habits.ownerId, userId)))
    .returning();

  return result[0];
}


