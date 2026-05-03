import { parseISO, startOfDay, differenceInDays } from 'date-fns';

export async function recalculateBucketStreak(sql: any, bucketId: string, userId: string, fromDate?: string) {
  const bucketRes = await sql`SELECT "longestStreak", "streakAnchorDate" FROM buckets WHERE id = ${bucketId}::uuid`;
  if (!bucketRes || bucketRes.length === 0) return;
  const bucket = bucketRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;

  if (fromDate) {
    const prevLog = await sql`
      SELECT "streakCount", date FROM bucketlogs 
      WHERE bucketid = ${bucketId}::uuid AND ownerid = ${userId} AND date < ${fromDate}
      ORDER BY date DESC LIMIT 1
    `;
    if (prevLog && prevLog.length > 0) {
      runningStreak = prevLog[0].streakCount;
      lastDate = startOfDay(parseISO(prevLog[0].date));
    }
  }

  const logs = await sql`
    SELECT * FROM bucketlogs 
    WHERE bucketid = ${bucketId}::uuid AND ownerid = ${userId}
    ${queryStartDate ? sql`AND date >= ${queryStartDate}` : sql``}
    ORDER BY date ASC
  `;

  if (!logs || logs.length === 0) {
    if (!fromDate) {
      const result = await sql`
        UPDATE buckets 
        SET "currentStreak" = 0, "streakAnchorDate" = NULL, updatedat = NOW()
        WHERE id = ${bucketId}::uuid AND ownerid = ${userId}
        RETURNING *
      `;
      return result[0];
    }
    
    const result = await sql`
      UPDATE buckets 
      SET "currentStreak" = ${runningStreak}, 
          updatedat = NOW()
      WHERE id = ${bucketId}::uuid AND ownerid = ${userId}
      RETURNING *
    `;
    return result[0];
  }

  let maxStreak = bucket.longestStreak || 0;
  let streakAnchorDate: string | null = bucket.streakAnchorDate;
  const updates: any[] = [];

  for (const log of logs) {
    const currentDate = startOfDay(parseISO(log.date));
    
    if (lastDate) {
      const diff = differenceInDays(currentDate, lastDate);
      if (diff > 1) {
        runningStreak = 0; 
      }
    }
    
    let brokenStreakCount = 0;
    if (log.status === 'completed') {
      runningStreak++;
    } else if (log.status === 'failed') {
      brokenStreakCount = runningStreak;
      runningStreak = 0;
    } else if (log.status === 'cleared') {
      runningStreak = 0;
    } 

    maxStreak = Math.max(maxStreak, runningStreak);
    
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

  if (updates.length > 0) {
    const ids = updates.map(u => u.id);
    const scs = updates.map(u => u.streakCount);
    const bscs = updates.map(u => u.brokenStreakCount);

    await sql`
      UPDATE bucketlogs AS h SET
        "streakCount" = v.sc,
        "brokenStreakCount" = v.bsc,
        updatedat = NOW()
      FROM (
        SELECT * FROM UNNEST(${ids}::text[], ${scs}::int[], ${bscs}::int[])
        AS t(id, sc, bsc)
      ) AS v
      WHERE h.id = v.id
    `;
  }

  const result = await sql`
    UPDATE buckets 
    SET 
      "currentStreak" = ${runningStreak}, 
      "longestStreak" = ${maxStreak},
      "streakAnchorDate" = ${streakAnchorDate},
      updatedat = NOW()
    WHERE id = ${bucketId}::uuid AND ownerid = ${userId}
    RETURNING *
  `;
  
  return result[0];
}

export async function syncBucketLogsForHabit(sql: any, habitId: string, userId: string, date: string) {
  const buckets = await sql`
    SELECT b.id FROM buckets b
    JOIN bucket_habits bh ON b.id = bh.bucket_id
    WHERE bh.habit_id = ${habitId}::uuid AND b.ownerid = ${userId}
  `;

  const updatedBuckets = [];
  for (const bucket of buckets) {
    const updated = await syncSingleBucketLog(sql, bucket.id, userId, date);
    if (updated) updatedBuckets.push(updated);
  }
  return updatedBuckets;
}

export async function syncSingleBucketLog(sql: any, bucketId: string, userId: string, date: string) {
  const habitsRes = await sql`
    SELECT habit_id FROM bucket_habits WHERE bucket_id = ${bucketId}::uuid
  `;
  
  if (habitsRes.length === 0) {
    await sql`DELETE FROM bucketlogs WHERE bucketid = ${bucketId}::uuid AND date = ${date}`;
    await recalculateBucketStreak(sql, bucketId, userId, date);
    return;
  }

  const habitIds = habitsRes.map((h: any) => h.habit_id);

  const logsRes = await sql`
    SELECT status FROM habitlogs 
    WHERE habitid = ANY(${habitIds}::text[]) AND ownerid = ${userId} AND date = ${date}
      AND status != 'cleared'
  `;

  if (logsRes.length === habitsRes.length) {
    let finalStatus = 'completed';
    const statuses = logsRes.map((l: any) => l.status);
    
    if (statuses.includes('failed')) {
      finalStatus = 'failed';
    } else if (statuses.includes('skipped')) {
      finalStatus = 'skipped';
    } else if (statuses.includes('vacation')) {
      finalStatus = 'vacation';
    }

    const logId = `${bucketId}_${date}`;
    await sql`
      INSERT INTO bucketlogs (id, bucketid, ownerid, date, status, updatedat)
      VALUES (${logId}, ${bucketId}::uuid, ${userId}, ${date}, ${finalStatus}, NOW())
      ON CONFLICT (id) DO UPDATE 
      SET status = ${finalStatus}, updatedat = NOW()
    `;
  } else {
    const logId = `${bucketId}_${date}`;
    await sql`
      INSERT INTO bucketlogs (id, bucketid, ownerid, date, status, updatedat)
      VALUES (${logId}, ${bucketId}::uuid, ${userId}, ${date}, 'cleared', NOW())
      ON CONFLICT (id) DO UPDATE 
      SET status = 'cleared', updatedat = NOW()
    `;
  }

  return await recalculateBucketStreak(sql, bucketId, userId, date);
}

export async function reevaluateBucketLogs(sql: any, bucketId: string, userId: string) {
  await sql`DELETE FROM bucketlogs WHERE bucketid = ${bucketId}::uuid AND ownerid = ${userId}`;
  
  const habitsRes = await sql`SELECT habit_id FROM bucket_habits WHERE bucket_id = ${bucketId}::uuid`;
  if (habitsRes.length === 0) {
    await recalculateBucketStreak(sql, bucketId, userId);
    return;
  }
  const habitIds = habitsRes.map((h: any) => h.habit_id);
  
  const datesRes = await sql`
    SELECT DISTINCT date FROM habitlogs 
    WHERE habitid = ANY(${habitIds}::text[]) AND ownerid = ${userId}
      AND status != 'cleared'
  `;
  
  for (const row of datesRes) {
    await syncSingleBucketLog(sql, bucketId, userId, String(row.date));
  }
  
  await recalculateBucketStreak(sql, bucketId, userId);
}
