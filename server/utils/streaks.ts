import { parseISO, subDays, isAfter, startOfDay, differenceInDays } from 'date-fns';

export async function recalculateHabitStreak(sql: any, habitId: string, userId: string) {
  // Fetch all logs for this habit, ordered newest first
  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE habitid = ${habitId} AND ownerid = ${userId}
    ORDER BY date DESC
  `;

  if (!logs || logs.length === 0) {
    await sql`
      UPDATE habits 
      SET "currentStreak" = 0, "streakAnchorDate" = NULL, updatedat = NOW()
      WHERE id = ${habitId} AND ownerid = ${userId}
    `;
    return;
  }

  const today = startOfDay(new Date());
  
  // Find anchor: first log that is not in the future and has a valid status
  let anchorIndex = -1;
  for (let i = 0; i < logs.length; i++) {
    const logDate = startOfDay(parseISO(logs[i].date));
    if (!isAfter(logDate, today) && ['completed', 'failed', 'skipped'].includes(logs[i].status)) {
      anchorIndex = i;
      break;
    }
  }

  if (anchorIndex === -1) {
    await sql`
      UPDATE habits 
      SET "currentStreak" = 0, "streakAnchorDate" = NULL, updatedat = NOW()
      WHERE id = ${habitId} AND ownerid = ${userId}
    `;
    return;
  }

  const anchorLog = logs[anchorIndex];
  const streakAnchorDate = anchorLog.date;
  let currentStreak = 0;

  if (anchorLog.status === 'failed') {
    currentStreak = 0;
  } else {
    if (anchorLog.status === 'completed') {
      currentStreak = 1;
    }
    
    let expectedNextDate = subDays(parseISO(anchorLog.date), 1);
    
    for (let i = anchorIndex + 1; i < logs.length; i++) {
      const log = logs[i];
      const logDate = startOfDay(parseISO(log.date));
      
      // Skip duplicates for the same day
      if (i > 0 && log.date === logs[i-1].date) continue;

      const diff = differenceInDays(expectedNextDate, logDate);
      
      // If the log is older than we expect, there is a gap (missing days)
      if (diff > 0) {
        break; // Streak broken by gap
      }
      
      if (diff < 0) {
         continue; // Should not happen with DESC sort, but safe to skip
      }

      // Exact match for expected date
      if (log.status === 'completed') {
        currentStreak++;
        expectedNextDate = subDays(expectedNextDate, 1);
      } else if (log.status === 'skipped') {
        expectedNextDate = subDays(expectedNextDate, 1);
      } else if (log.status === 'failed') {
        break; // Streak broken by explicit failure
      }
    }
  }

  // Update habit with new streak data
  await sql`
    UPDATE habits 
    SET 
      "currentStreak" = ${currentStreak}, 
      "longestStreak" = GREATEST("longestStreak", ${currentStreak}),
      "streakAnchorDate" = ${streakAnchorDate},
      updatedat = NOW()
    WHERE id = ${habitId} AND ownerid = ${userId}
  `;
}
