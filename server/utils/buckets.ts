import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, sql, desc, asc, and, inArray } from 'drizzle-orm';
import { buckets, bucketLogs, bucketHabits, habits as habitsTable, sharedBucketMembers, habitLogs } from '../db/schema';
import { normalizeBucket } from './normalize';

export async function recalculateBucketStreak(db: any, bucketId: string, userId: string, fromDate?: string) {
  if (!bucketId || bucketId.length < 36) return;
  const bucketRes = await db.select({
    longestStreak: buckets.longestStreak,
    streakAnchorDate: buckets.streakAnchorDate
  })
  .from(buckets)
  .where(eq(buckets.id, bucketId));

  if (!bucketRes || bucketRes.length === 0) return;
  const bucket = bucketRes[0];

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;
  let maxStreak = 0;

  if (fromDate) {
    const prevLogRes = await db.select({
      streakCount: bucketLogs.streakCount,
      date: bucketLogs.date
    })
    .from(bucketLogs)
    .where(sql`${bucketLogs.bucketId} = ${bucketId} AND ${bucketLogs.ownerId} = ${userId} AND ${bucketLogs.date} < ${fromDate}`)
    .orderBy(desc(bucketLogs.date))
    .limit(1);

    if (prevLogRes && prevLogRes.length > 0) {
      const prevLog = prevLogRes[0];
      runningStreak = prevLog.streakCount;
      lastDate = startOfDay(parseISO(prevLog.date));
    }

    const maxRes = await db.select({
      maxStreak: sql`MAX(${bucketLogs.streakCount})`
    })
    .from(bucketLogs)
    .where(sql`${bucketLogs.bucketId} = ${bucketId} AND ${bucketLogs.ownerId} = ${userId} AND ${bucketLogs.date} < ${fromDate}`);
    
    maxStreak = Number(maxRes[0]?.maxStreak || 0);
  }

  const logsQuery = db.select()
    .from(bucketLogs)
    .where(sql`${bucketLogs.bucketId} = ${bucketId} AND ${bucketLogs.ownerId} = ${userId}`);

  if (queryStartDate) {
    logsQuery.where(sql`${bucketLogs.bucketId} = ${bucketId} AND ${bucketLogs.ownerId} = ${userId} AND ${bucketLogs.date} >= ${queryStartDate}`);
  }
  
  const rawLogs = await logsQuery.orderBy(asc(bucketLogs.date));

  if (!rawLogs || rawLogs.length === 0) {
    if (!fromDate) {
      const result = await db.update(buckets)
        .set({
          currentStreak: 0,
          streakAnchorDate: null,
          updatedAt: new Date()
        })
        .where(eq(buckets.id, bucketId))
        .returning();
      return result[0];
    }
    
    const result = await db.update(buckets)
      .set({
        currentStreak: runningStreak,
        updatedAt: new Date()
      })
      .where(eq(buckets.id, bucketId))
      .returning();
    return result[0];
  }

  const logs = rawLogs;

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
    for (const update of updates) {
      await db.update(bucketLogs)
        .set({
          streakCount: update.streakCount,
          brokenStreakCount: update.brokenStreakCount,
          updatedAt: new Date()
        })
        .where(eq(bucketLogs.id, update.id));
    }
  }

  const result = await db.update(buckets)
    .set({
      currentStreak: runningStreak,
      longestStreak: maxStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: new Date()
    })
    .where(eq(buckets.id, bucketId))
    .returning();
  
  return result[0];
}

export async function syncBucketLogsForHabit(db: any, habitId: string, userId: string, date: string) {
  if (!habitId || habitId.length < 36) return [];
  const bucketsRes = await db.select({
    id: buckets.id
  })
  .from(buckets)
  .innerJoin(bucketHabits, eq(buckets.id, bucketHabits.bucketId))
  .where(and(eq(bucketHabits.habitId, habitId), eq(buckets.ownerId, userId)));

  const updatedBuckets = [];
  for (const bucket of bucketsRes) {
    const updated = await syncSingleBucketLog(db, bucket.id, userId, date);
    if (updated) updatedBuckets.push(updated);
  }
  return updatedBuckets;
}

export async function syncSingleBucketLog(db: any, bucketId: string, userId: string, date: string) {
  if (!bucketId || bucketId.length < 36) return;
  
  const sharedMembersRes = await db.select({ count: sql`count(*)` })
    .from(sharedBucketMembers)
    .where(eq(sharedBucketMembers.bucketId, bucketId));
  const isShared = Number(sharedMembersRes[0].count) > 0;

  let habitsRes;
  if (isShared) {
    habitsRes = await db.select({
      habitId: bucketHabits.habitId
    })
    .from(bucketHabits)
    .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
    .where(and(
      eq(bucketHabits.bucketId, bucketId),
      eq(habitsTable.ownerId, userId),
      eq(bucketHabits.approvalStatus, 'accepted')
    ));
  } else {
    habitsRes = await db.select({
      habitId: bucketHabits.habitId
    })
    .from(bucketHabits)
    .where(eq(bucketHabits.bucketId, bucketId));
  }
  
  if (habitsRes.length === 0) return;

  const habitIds = habitsRes.map((h: any) => h.habitId);

  const rawLogs = await db.select({
    status: habitLogs.status,
    habitId: habitLogs.habitId
  })
  .from(habitLogs)
  .where(and(
    inArray(habitLogs.habitId, habitIds),
    eq(habitLogs.ownerId, userId),
    eq(habitLogs.date, date),
    sql`${habitLogs.status} != 'cleared'`
  ));

  const uniqueLoggedHabitIds = new Set(rawLogs.map((l: any) => l.habitId));

  if (uniqueLoggedHabitIds.size === habitsRes.length) {
    let finalStatus = 'completed';
    const statuses = rawLogs.map((l: any) => l.status);
    
    if (statuses.includes('failed')) {
      finalStatus = 'failed';
    } else if (statuses.includes('skipped')) {
      finalStatus = 'skipped';
    } else if (statuses.includes('vacation')) {
      finalStatus = 'vacation';
    }

    const logId = `${bucketId}_${date}_${userId}`;
    await db.insert(bucketLogs)
      .values({
        id: logId,
        bucketId: bucketId,
        ownerId: userId,
        date: date,
        status: finalStatus,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: bucketLogs.id,
        set: { status: finalStatus, updatedAt: new Date() }
      });
  } else {
    const logId = `${bucketId}_${date}_${userId}`;
    await db.insert(bucketLogs)
      .values({
        id: logId,
        bucketId: bucketId,
        ownerId: userId,
        date: date,
        status: 'cleared',
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: bucketLogs.id,
        set: { status: 'cleared', updatedAt: new Date() }
      });
  }

  return await recalculateBucketStreak(db, bucketId, userId, date);
}

export async function reevaluateBucketLogs(db: any, bucketId: string, userId: string) {
  await db.delete(bucketLogs)
    .where(and(eq(bucketLogs.bucketId, bucketId), eq(bucketLogs.ownerId, userId)));
  
  const sharedMembersRes = await db.select({ count: sql`count(*)` })
    .from(sharedBucketMembers)
    .where(eq(sharedBucketMembers.bucketId, bucketId));
  const isShared = Number(sharedMembersRes[0].count) > 0;

  let habitsRes;
  if (isShared) {
    habitsRes = await db.select({
      habitId: bucketHabits.habitId
    })
    .from(bucketHabits)
    .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
    .where(and(
      eq(bucketHabits.bucketId, bucketId),
      eq(habitsTable.ownerId, userId),
      eq(bucketHabits.approvalStatus, 'accepted')
    ));
  } else {
    habitsRes = await db.select({
      habitId: bucketHabits.habitId
    })
    .from(bucketHabits)
    .where(eq(bucketHabits.bucketId, bucketId));
  }

  if (habitsRes.length === 0) {
    await recalculateBucketStreak(db, bucketId, userId);
    return;
  }
  const habitIds = habitsRes.map((h: any) => h.habitId);
  
  const datesRes = await db.selectDistinct({
    date: habitLogs.date
  })
  .from(habitLogs)
  .where(and(
    inArray(habitLogs.habitId, habitIds),
    eq(habitLogs.ownerId, userId),
    sql`${habitLogs.status} != 'cleared'`
  ));
  
  for (const row of datesRes) {
    await syncSingleBucketLog(db, bucketId, userId, String(row.date));
  }
  
  await recalculateBucketStreak(db, bucketId, userId);
}
