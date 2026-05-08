import { eq, and, sql, inArray, ne } from 'drizzle-orm';
import { extractRows } from './db';
import { bucketHabits, buckets } from '../db/schema';
import { reevaluateBucketLogs } from './buckets';

/**
 * Marks specific habits as 'removed' in all buckets owned by the target users.
 * Then re-evaluates logs for each affected bucket.
 */
export async function markBucketHabitsRemoved(db: any, habitIds: string[], targetUserIds: string[]) {
  if (!habitIds.length || !targetUserIds.length) return;

  // Update status and return affected buckets with their owners
  const affected = await db.execute(sql`
    UPDATE bucket_habits bh
    SET approval_status = 'removed'
    FROM buckets b
    WHERE bh.bucket_id = b.id
      AND bh.habit_id IN (${sql.join(habitIds.map(id => sql`${id}`), sql`, `)})
      AND b.owner_id IN (${sql.join(targetUserIds.map(id => sql`${id}`), sql`, `)})
      AND bh.approval_status != 'removed'
    RETURNING bh.bucket_id, b.owner_id
  `);

  const rows = extractRows<any>(affected);
  if (rows.length === 0) return;

  // Get unique bucket/owner pairs
  const uniqueBuckets = Array.from(
    new Map(rows.map((a: any) => [`${a.bucket_id}-${a.owner_id}`, a])).values()
  ) as { bucket_id: string; owner_id: string }[];

  for (const row of uniqueBuckets) {
    await reevaluateBucketLogs(db, row.bucket_id, row.owner_id);
  }
}
