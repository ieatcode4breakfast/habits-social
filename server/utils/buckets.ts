import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, sql, desc, asc, and, inArray } from 'drizzle-orm';
  import { buckets, bucketLogs, bucketHabits, habits as habitsTable, sharedBucketMembers, habitLogs } from '../db/schema';
import { calculateStreakFromLogs } from '../../utils/habits';

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

  // 4. Use shared logic for calculation
  const { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    rawLogs,
    runningStreak,
    lastDate,
    maxStreak,
    bucket.streakAnchorDate
  );

  // 5. Update bucketlogs in batch
  if (logUpdates.length > 0) {
    const sqlValues = logUpdates.map(u => sql`(${u.id}::text, ${u.streakCount}::integer, ${u.brokenStreakCount}::integer)`);
    const valuesList = sql.join(sqlValues, sql`, `);
    
    await db.execute(sql`
      UPDATE bucket_logs AS bl
      SET 
        streak_count = v.streak_count,
        broken_streak_count = v.broken_streak_count,
        updated_at = NOW()
      FROM (VALUES ${valuesList}) AS v(id, streak_count, broken_streak_count)
      WHERE bl.id = v.id
    `);
  }

  const result = await db.update(buckets)
    .set({
      currentStreak: currentStreak,
      longestStreak: longestStreak,
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
