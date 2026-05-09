import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';
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
  
  // 1. Find all affected buckets
  const bucketsRes = await db.select({
    id: buckets.id,
    ownerId: buckets.ownerId
  })
  .from(buckets)
  .innerJoin(bucketHabits, eq(buckets.id, bucketHabits.bucketId))
  .where(and(eq(bucketHabits.habitId, habitId), eq(buckets.ownerId, userId)));

  if (bucketsRes.length === 0) return [];

  // 2. Bulk Sync: Calculate and update logs for all buckets on this date in one query
  const bucketIds = bucketsRes.map(b => b.id);
  const idList = sql.join(bucketIds.map(id => sql`${id}`), sql`, `);

  await db.execute(sql`
    INSERT INTO bucket_logs (id, bucket_id, owner_id, date, status, updated_at)
    SELECT 
      b.id::text || '_' || ${date} || '_' || b.owner_id::text as id,
      b.id as bucket_id,
      b.owner_id as owner_id,
      ${date} as date,
      CASE 
        WHEN COUNT(DISTINCT hl.habit_id) < (SELECT COUNT(*) FROM bucket_habits WHERE bucket_id = b.id AND approval_status = 'accepted') THEN 'cleared'
        WHEN bool_or(hl.status = 'failed') THEN 'failed'
        WHEN bool_or(hl.status = 'skipped') THEN 'skipped'
        WHEN bool_or(hl.status = 'vacation') THEN 'vacation'
        ELSE 'completed'
      END as status,
      NOW() as updated_at
    FROM buckets b
    JOIN bucket_habits bh ON b.id = bh.bucket_id
    LEFT JOIN habit_logs hl ON bh.habit_id = hl.habit_id AND hl.owner_id = b.owner_id AND hl.date = ${date} AND hl.status != 'cleared'
    WHERE b.id::text IN (${idList})
      AND bh.approval_status = 'accepted'
    GROUP BY b.id, b.owner_id
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  `);

  // 3. Recalculate streaks for all affected buckets
  const results = [];
  for (const bucket of bucketsRes) {
    const res = await recalculateBucketStreak(db, bucket.id, bucket.ownerId, date);
    if (res) results.push(res);
  }
  return results;
}

export async function syncSingleBucketLog(db: any, bucketId: string, userId: string, date: string, options: { skipStreakRecalculation?: boolean } = {}) {
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

  if (options.skipStreakRecalculation) {
    return { bucketId, date, userId };
  }
  return await recalculateBucketStreak(db, bucketId, userId, date);
}

export async function reevaluateBucketLogs(db: any, bucketId: string, userId: string) {
  return await reevaluateMultipleBuckets(db, [{ bucketId, ownerId: userId }]);
}

/**
 * Bulk reevaluates logs for multiple buckets in a single SQL operation.
 * Eliminates the "Power User unfriend" locking risk.
 */
export async function reevaluateMultipleBuckets(db: any, items: { bucketId: string, ownerId: string }[]) {
  if (items.length === 0) return;

  // 1. Delete all existing bucket logs for target buckets/owners
  const conditions = items.map(i => and(eq(bucketLogs.bucketId, i.bucketId), eq(bucketLogs.ownerId, i.ownerId)));
  await db.delete(bucketLogs).where(or(...conditions));

  // 2. Perform bulk reevaluation
  const values = items.map(i => sql`(${i.bucketId}::text, ${i.ownerId}::text)`);
  const valuesList = sql.join(values, sql`, `);

  await db.execute(sql`
    WITH target_buckets(id, owner_id) AS (
      VALUES ${valuesList}
    )
    INSERT INTO bucket_logs (id, bucket_id, owner_id, date, status, updated_at)
    SELECT 
      tb.id || '_' || hl.date || '_' || tb.owner_id as id,
      tb.id::uuid as bucket_id,
      tb.owner_id::uuid as owner_id,
      hl.date,
      CASE 
        WHEN COUNT(DISTINCT hl.habit_id) < (SELECT COUNT(*) FROM bucket_habits WHERE bucket_id = tb.id::uuid AND approval_status = 'accepted') THEN 'cleared'
        WHEN bool_or(hl.status = 'failed') THEN 'failed'
        WHEN bool_or(hl.status = 'skipped') THEN 'skipped'
        WHEN bool_or(hl.status = 'vacation') THEN 'vacation'
        ELSE 'completed'
      END as status,
      NOW() as updated_at
    FROM target_buckets tb
    JOIN bucket_habits bh ON tb.id::uuid = bh.bucket_id
    JOIN habit_logs hl ON bh.habit_id = hl.habit_id AND hl.owner_id = tb.owner_id::uuid
    WHERE hl.status != 'cleared'
      AND bh.approval_status = 'accepted'
    GROUP BY tb.id, tb.owner_id, hl.date
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  `);

  // 3. Recalculate streaks
  // While this is still sequential for now, the internal N+1 date loop is gone.
  for (const item of items) {
    await recalculateBucketStreak(db, item.bucketId, item.ownerId);
  }
}
