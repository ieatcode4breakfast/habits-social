import { parseISO, startOfDay, differenceInDays } from 'date-fns';

export async function recalculateHabitStreak(sql: any, habitId: string, userId: string, fromDate?: string) {
  if (!habitId || habitId.length < 36) return;
  // 1. Fetch habit info
  const habitRes = await sql`SELECT longest_streak, streak_anchor_date FROM habits WHERE id = ${habitId}::uuid`;
  if (!habitRes || habitRes.length === 0) return;
  const habit = habitRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;
  let maxStreak = 0;

  // 2. If incremental, find the starting point state from the log just before fromDate
  if (fromDate) {
    const prevLog = await sql`
      SELECT streak_count, date FROM habit_logs 
      WHERE habit_id = ${habitId}::uuid AND owner_id = ${userId} AND date < ${fromDate}
      ORDER BY date DESC LIMIT 1
    `;
    if (prevLog && prevLog.length > 0) {
      runningStreak = prevLog[0].streakCount;
      lastDate = startOfDay(parseISO(prevLog[0].date));
    }

    const maxRes = await sql`
      SELECT MAX(streak_count) as max_streak FROM habit_logs 
      WHERE habit_id = ${habitId}::uuid AND owner_id = ${userId} AND date < ${fromDate}
    `;
    maxStreak = maxRes[0]?.maxStreak || 0;
  }

  // 3. Fetch logs from starting point onwards
  const logs = queryStartDate 
    ? await sql`
        SELECT id, date, status, streak_count, broken_streak_count FROM habit_logs 
        WHERE habit_id = ${habitId}::uuid AND owner_id = ${userId}
          AND date >= ${queryStartDate}
        ORDER BY date ASC
      `
    : await sql`
        SELECT id, date, status, streak_count, broken_streak_count FROM habit_logs 
        WHERE habit_id = ${habitId}::uuid AND owner_id = ${userId}
        ORDER BY date ASC
      `;

  if (!logs || logs.length === 0) {
    // If we're doing a full rebuild and no logs, reset habit.
    if (!fromDate) {
      const result = await sql`
        UPDATE habits 
        SET current_streak = 0, streak_anchor_date = NULL, updated_at = NOW()
        WHERE id = ${habitId}::uuid AND owner_id = ${userId}
        RETURNING id, owner_id, current_streak, longest_streak, streak_anchor_date, updated_at
      `;
      return result[0];
    }

    // INCREMENTAL FIX: Even if no logs are found at/after fromDate, we MUST update the habit
    // to match the state of the last known log (runningStreak from prevLog).
    const result = await sql`
      UPDATE habits 
      SET current_streak = ${runningStreak}, 
          updated_at = NOW()
      WHERE id = ${habitId}::uuid AND owner_id = ${userId}
      RETURNING id, owner_id, current_streak, longest_streak, streak_anchor_date, updated_at
    `;
    return result[0];
  }

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

    // Only update if values changed (Optimization)
    if (log.streakCount !== runningStreak || log.brokenStreakCount !== brokenStreakCount) {
      updates.push({
        id: log.id,
        streakCount: runningStreak,
        brokenStreakCount: brokenStreakCount
      });
    }

    lastDate = currentDate;
  }

  // 5. Batch Update habitlogs (Optimization)
  if (updates.length > 0) {
    const ids = updates.map(u => u.id);
    const scs = updates.map(u => u.streakCount);
    const bscs = updates.map(u => u.brokenStreakCount);

    await sql`
      UPDATE habit_logs AS h SET
        streak_count = v.sc,
        broken_streak_count = v.bsc,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(${ids}::text[], ${scs}::int[], ${bscs}::int[])
        AS t(id, sc, bsc)
      ) AS v
      WHERE h.id = v.id
    `;
  }

  // 6. Final Habit Update: Set current and longest streak
  const result = await sql`
    UPDATE habits 
    SET 
      current_streak = ${runningStreak}, 
      longest_streak = ${maxStreak},
      streak_anchor_date = ${streakAnchorDate},
      updated_at = NOW()
    WHERE id = ${habitId}::uuid AND owner_id = ${userId}
    RETURNING id, owner_id, current_streak, longest_streak, streak_anchor_date, updated_at
  `;

  return result[0];
}
