import { parseISO, startOfDay, differenceInDays } from 'date-fns';

export async function recalculateHabitStreak(sql: any, habitId: string, userId: string) {
  // 1. Fetch habit info
  const habitRes = await sql`SELECT "frequencyPeriod", "frequencyCount" FROM habits WHERE id = ${habitId}`;
  if (!habitRes || habitRes.length === 0) return;

  // 2. Fetch all logs for this habit in ascending order to process timeline
  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE habitid = ${habitId} AND ownerid = ${userId}
    ORDER BY date ASC
  `;

  if (!logs || logs.length === 0) {
    const result = await sql`
      UPDATE habits 
      SET "currentStreak" = 0, "streakAnchorDate" = NULL, updatedat = NOW()
      WHERE id = ${habitId} AND ownerid = ${userId}
      RETURNING *
    `;
    return result[0];
  }

  // 3. The Cascading Update: Iterate through timeline and stamp streakCount
  let runningStreak = 0;
  let maxStreak = 0;
  let lastDate: Date | null = null;
  let streakAnchorDate: string | null = null;

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
    } else if (log.status === 'skipped') {
      // Streak remains intact (protected)
    }

    maxStreak = Math.max(maxStreak, runningStreak);
    
    // The anchor is always the most recent log date with a valid status
    if (['completed', 'failed', 'skipped'].includes(log.status)) {
      streakAnchorDate = log.date;
    }

    // Update the specific log with its historical streakCount
    await sql`
      UPDATE habitlogs 
      SET "streakCount" = ${runningStreak}, "brokenStreakCount" = ${brokenStreakCount}, updatedat = NOW()
      WHERE id = ${log.id}
    `;
    
    lastDate = currentDate;
  }

  // 4. Final Habit Update: Set current and longest streak
  const result = await sql`
    UPDATE habits 
    SET 
      "currentStreak" = ${runningStreak}, 
      "longestStreak" = GREATEST(COALESCE("longestStreak", 0), ${maxStreak}),
      "streakAnchorDate" = ${streakAnchorDate},
      updatedat = NOW()
    WHERE id = ${habitId} AND ownerid = ${userId}
    RETURNING *
  `;
  
  return result[0];
}
