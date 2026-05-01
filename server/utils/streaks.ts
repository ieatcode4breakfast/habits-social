import { parseISO, startOfDay, differenceInDays } from 'date-fns';

export async function recalculateHabitStreak(sql: any, habitId: string, userId: string, fromDate?: string) {
  // 1. Fetch habit info
  const habitRes = await sql`SELECT "frequencyPeriod", "frequencyCount", "longestStreak", "streakAnchorDate" FROM habits WHERE id = ${habitId}`;
  if (!habitRes || habitRes.length === 0) return;
  const habit = habitRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;

  // 2. If incremental, find the starting point state from the log just before fromDate
  if (fromDate) {
    const prevLog = await sql`
      SELECT "streakCount", date FROM habitlogs 
      WHERE habitid = ${habitId} AND ownerid = ${userId} AND date < ${fromDate}
      ORDER BY date DESC LIMIT 1
    `;
    if (prevLog && prevLog.length > 0) {
      runningStreak = prevLog[0].streakCount;
      lastDate = startOfDay(parseISO(prevLog[0].date));
    }
  }

  // 3. Fetch logs from starting point onwards
  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE habitid = ${habitId} AND ownerid = ${userId}
    ${queryStartDate ? sql`AND date >= ${queryStartDate}` : sql``}
    ORDER BY date ASC
  `;

  if (!logs || logs.length === 0) {
    // If we're doing a full rebuild and no logs, reset habit.
    if (!fromDate) {
      const result = await sql`
        UPDATE habits 
        SET "currentStreak" = 0, "streakAnchorDate" = NULL, updatedat = NOW()
        WHERE id = ${habitId} AND ownerid = ${userId}
        RETURNING *
      `;
      return result[0];
    }
    
    // INCREMENTAL FIX: Even if no logs are found at/after fromDate, we MUST update the habit
    // to match the state of the last known log (runningStreak from prevLog).
    const result = await sql`
      UPDATE habits 
      SET "currentStreak" = ${runningStreak}, 
          updatedat = NOW()
      WHERE id = ${habitId} AND ownerid = ${userId}
      RETURNING *
    `;
    return result[0];
  }

  // 4. The Cascading Update: Iterate through timeline and calculate counts
  let maxStreak = habit.longestStreak || 0;
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
    } else if (log.status === 'skipped') {
      // Streak remains intact (protected)
    }

    maxStreak = Math.max(maxStreak, runningStreak);
    
    // The anchor is the most recent log date with a valid status
    if (['completed', 'failed', 'skipped'].includes(log.status)) {
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
      UPDATE habitlogs AS h SET
        "streakCount" = v.sc,
        "brokenStreakCount" = v.bsc,
        updatedat = NOW()
      FROM (
        SELECT * FROM UNNEST(${ids}::uuid[], ${scs}::int[], ${bscs}::int[])
        AS t(id, sc, bsc)
      ) AS v
      WHERE h.id = v.id
    `;
  }

  // 6. Final Habit Update: Set current and longest streak
  const result = await sql`
    UPDATE habits 
    SET 
      "currentStreak" = ${runningStreak}, 
      "longestStreak" = ${maxStreak},
      "streakAnchorDate" = ${streakAnchorDate},
      updatedat = NOW()
    WHERE id = ${habitId} AND ownerid = ${userId}
    RETURNING *
  `;
  
  return result[0];
}
