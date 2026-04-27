import { parseISO, subDays, startOfDay, differenceInDays, startOfWeek, subWeeks, isSameWeek, startOfMonth, subMonths, isSameMonth, isSameDay } from 'date-fns';

export async function recalculateHabitStreak(sql: any, habitId: string, userId: string) {
  const habitRes = await sql`SELECT "frequencyPeriod", "frequencyCount" FROM habits WHERE id = ${habitId}`;
  if (!habitRes || habitRes.length === 0) return;
  const period = habitRes[0].frequencyPeriod;
  const count = habitRes[0].frequencyCount;

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

  // Find anchor: first log with a valid status
  let anchorIndex = -1;
  for (let i = 0; i < logs.length; i++) {
    if (['completed', 'failed', 'skipped'].includes(logs[i].status)) {
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
  let streakAnchorDate: string | null = anchorLog.date;
  let currentStreak = 0;

  let checkDate = startOfDay(parseISO(anchorLog.date));
  
  let logToday = logs.find((l: any) => isSameDay(parseISO(l.date), checkDate));
  
  if (logToday?.status === 'failed') {
    currentStreak = 0;
  } else {
    if (logToday?.status === 'completed') {
      currentStreak++;
    }
    
    while (true) {
      checkDate = subDays(checkDate, 1);
      let log = logs.find((l: any) => isSameDay(parseISO(l.date), checkDate));
      
      if (log?.status === 'failed') {
        break;
      } else if (log?.status === 'skipped') {
        continue; 
      } else if (log?.status === 'completed') {
        currentStreak++;
      } else {
        // No log -> gap!
        break;
      }
    }
  }

  // Update habit with new streak data
  await sql`
    UPDATE habits 
    SET 
      "currentStreak" = ${currentStreak}, 
      "longestStreak" = GREATEST(COALESCE("longestStreak", 0), ${currentStreak}),
      "streakAnchorDate" = ${streakAnchorDate},
      updatedat = NOW()
    WHERE id = ${habitId} AND ownerid = ${userId}
  `;
}
