import { reevaluateBucketLogs } from './buckets';

/**
 * Marks specific habits as 'removed' in all buckets owned by the target users.
 * Then re-evaluates logs for each affected bucket.
 */
export async function markBucketHabitsRemoved(sql: any, habitIds: string[], targetUserIds: string[]) {
  if (!habitIds.length || !targetUserIds.length) return;

  // Update status and return affected buckets with their owners
  const affected = await sql`
    UPDATE bucket_habits bh
    SET approval_status = 'removed'
    FROM buckets b
    WHERE bh.bucket_id = b.id
      AND bh.habit_id = ANY(${habitIds}::uuid[])
      AND b.owner_id = ANY(${targetUserIds}::uuid[])
      AND bh.approval_status != 'removed'
    RETURNING bh.bucket_id, b.owner_id
  `;

  if (affected.length === 0) return;

  // Get unique bucket/owner pairs
  const uniqueBuckets = Array.from(
    new Map(affected.map((a: any) => [`${a.bucket_id}-${a.owner_id}`, a])).values()
  ) as { bucket_id: string; owner_id: string }[];

  for (const { bucket_id, owner_id } of uniqueBuckets) {
    await reevaluateBucketLogs(sql, bucket_id, owner_id);
  }
}
