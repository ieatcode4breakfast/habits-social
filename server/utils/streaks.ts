import { parseISO, startOfDay } from 'date-fns';
import { eq, asc, sql, and } from 'drizzle-orm';
import { habits, habitLogs } from '../db/schema';
import { calculateStreakFromLogs } from '../../utils/habits';


export async function recalculateHabitStreak(db: any, habitId: string, userId: string, fromDate?: string) {
  if (!habitId || habitId.length < 36) return;
  // 1. Fetch habit info
  const habitRes = await db.select({
    currentStreak: habits.currentStreak,
    longestStreak: habits.longestStreak,
    streakAnchorDate: habits.streakAnchorDate
  })
  .from(habits)
  .where(and(eq(habits.id, habitId), eq(habits.ownerId, userId)));

  if (!habitRes || habitRes.length === 0) return;
  const habit = habitRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let maxStreak = 0;
  let baselineAnchor: string | null = null;

  // 2. Fetch all logs for this habit from the beginning of time
  const rawLogs = await db.select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.ownerId, userId)))
    .orderBy(asc(habitLogs.date));

  if (!rawLogs || rawLogs.length === 0) {
    // Diff-check before updating parent habit
    if (habit.currentStreak !== 0 || habit.streakAnchorDate !== null) {
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
    return habit;
  }

  // 3. Use shared logic for calculation from the beginning of time
  let { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    rawLogs,
    runningStreak,
    lastDate,
    maxStreak,
    baselineAnchor
  );

  // 4. Update habitlogs in batch (only contains elements that actually changed in DB)
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

  // 5. Final Habit Update (Diff-checked to save database updates I/O)
  if (
    habit.currentStreak !== currentStreak ||
    habit.longestStreak !== longestStreak ||
    habit.streakAnchorDate !== streakAnchorDate
  ) {
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

  return habit;
}


