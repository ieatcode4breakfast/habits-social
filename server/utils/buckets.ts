import { eq, and, or, sql, asc, inArray } from 'drizzle-orm';
import { buckets, bucketLogs, bucketHabits, habitLogs } from '../db/schema';
import { calculateStreakFromLogs } from '../../utils/habits';

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
  const bucketIds = bucketsRes.map((b: any) => b.id);
  const idList = sql.join(bucketIds.map((id: string) => sql`${id}`), sql`, `);

  await db.execute(sql`
    INSERT INTO bucket_logs (id, bucket_id, owner_id, date, status, updated_at)
    SELECT 
      b.id::text || '_' || ${date} || '_' || b.owner_id::text as id,
      b.id as bucket_id,
      b.owner_id as owner_id,
      ${date} as date,
      CASE 
        WHEN bool_or(hl.status = 'failed') THEN 'failed'
        WHEN COUNT(DISTINCT hl.habit_id) < (SELECT COUNT(*) FROM bucket_habits WHERE bucket_id = b.id AND approval_status = 'accepted') THEN 'cleared'
        WHEN bool_or(hl.status = 'vacation') THEN 'vacation'
        WHEN bool_or(hl.status = 'skipped') THEN 'skipped'
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

  // 3. Recalculate streaks for all affected buckets in bulk
  await recalculateMultipleBucketStreaks(db, bucketsRes.map((b: any) => ({ bucketId: b.id, ownerId: b.ownerId })));
  return bucketsRes;
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
        WHEN bool_or(hl.status = 'failed') THEN 'failed'
        WHEN COUNT(DISTINCT hl.habit_id) < (SELECT COUNT(*) FROM bucket_habits WHERE bucket_id = tb.id::uuid AND approval_status = 'accepted') THEN 'cleared'
        WHEN bool_or(hl.status = 'vacation') THEN 'vacation'
        WHEN bool_or(hl.status = 'skipped') THEN 'skipped'
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

  // 3. Recalculate streaks for all buckets in a single operation
  await recalculateMultipleBucketStreaks(db, items);
}

/**
 * Truly bulk streak recalculation for any number of buckets.
 * Fetches all logs in one query and performs set-based updates.
 */
export async function recalculateMultipleBucketStreaks(db: any, items: { bucketId: string, ownerId: string }[]) {
  if (items.length === 0) return;

  const bucketIds = items.map(i => i.bucketId);
  const bucketInfo = await db.select({
    id: buckets.id,
    ownerId: buckets.ownerId
  })
  .from(buckets)
  .where(inArray(buckets.id, bucketIds));

  // 1. Fetch all logs for target buckets/owners in one query
  const conditions = items.map(i => and(eq(bucketLogs.bucketId, i.bucketId), eq(bucketLogs.ownerId, i.ownerId)));
  const allLogs = await db.select()
    .from(bucketLogs)
    .where(or(...conditions))
    .orderBy(asc(bucketLogs.bucketId), asc(bucketLogs.date));

  const bucketUpdates = [];
  const logUpdates = [];

  for (const item of items) {
    const bucket = bucketInfo.find((b: any) => b.id === item.bucketId);
    if (!bucket) continue;

    const logs = allLogs.filter((l: any) => l.bucketId === item.bucketId && l.ownerId === item.ownerId);
    const result = calculateStreakFromLogs(logs);

    bucketUpdates.push({
      id: item.bucketId,
      ownerId: item.ownerId,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      streakAnchorDate: result.streakAnchorDate
    });

    logUpdates.push(...result.logUpdates);
  }

  // 2. Bulk Update Buckets
  if (bucketUpdates.length > 0) {
    const values = bucketUpdates.map(u => 
      sql`(${u.id}::uuid, ${u.currentStreak}::int, ${u.longestStreak}::int, ${u.streakAnchorDate}::date, ${u.ownerId}::uuid)`
    );
    const valuesList = sql.join(values, sql`, `);
    await db.execute(sql`
      UPDATE buckets b
      SET 
        current_streak = v.current_streak,
        longest_streak = v.longest_streak,
        streak_anchor_date = v.streak_anchor_date,
        updated_at = NOW()
      FROM (VALUES ${valuesList}) AS v(id, current_streak, longest_streak, streak_anchor_date, owner_id)
      WHERE b.id = v.id AND b.owner_id = v.owner_id
    `);
  }

  // 3. Bulk Update Bucket Logs (Streaks)
  if (logUpdates.length > 0) {
    // Process in chunks to avoid massive SQL statements if history is huge
    const chunkSize = 500;
    for (let i = 0; i < logUpdates.length; i += chunkSize) {
      const chunk = logUpdates.slice(i, i + chunkSize);
      const logValues = chunk.map(u => 
        sql`(${u.id}::text, ${u.streakCount}::int, ${u.brokenStreakCount}::int)`
      );
      const logValuesList = sql.join(logValues, sql`, `);
      await db.execute(sql`
        UPDATE bucket_logs bl
        SET 
          streak_count = v.streak_count,
          broken_streak_count = v.broken_streak_count,
          updated_at = NOW()
        FROM (VALUES ${logValuesList}) AS v(id, streak_count, broken_streak_count)
        WHERE bl.id = v.id
      `);
    }
  }
}