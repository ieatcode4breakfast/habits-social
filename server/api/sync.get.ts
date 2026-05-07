import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { normalizeHabit, normalizeBucket, normalizeLog } from '~~/server/utils/normalize';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const query = getQuery(event);
  
  // Use a numeric timestamp in ms (epoch)
  const lastSynced = query.lastSynced ? Number(query.lastSynced) : 0;

  // 1. Get the current authoritative server time from the database
  const timeRes = await sql`SELECT EXTRACT(EPOCH FROM NOW()) * 1000 as now`;
  const firstRow = (timeRes as any[])?.[0];
  if (!firstRow) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get server time' });
  }
  const serverTime = Math.floor(Number(firstRow.now));

  // 2. Fetch all deltas in parallel
  const [habits, personalBuckets, sharedBuckets, habitLogs, bucketLogs, deletions] = await Promise.all([
    lastSynced > 0 
      ? sql`SELECT * FROM habits WHERE owner_id = ${userId} AND updated_at >= to_timestamp(${lastSynced} / 1000.0) ORDER BY sort_order ASC, created_at DESC`
      : sql`SELECT * FROM habits WHERE owner_id = ${userId} ORDER BY sort_order ASC, created_at DESC`,
    
    lastSynced > 0 
      ? sql`SELECT b.* FROM buckets b WHERE b.owner_id = ${userId} AND NOT EXISTS (SELECT 1 FROM shared_bucket_members sbm WHERE sbm.bucket_id = b.id) AND b.updated_at >= to_timestamp(${lastSynced} / 1000.0) ORDER BY b.sort_order ASC, b.created_at DESC`
      : sql`SELECT b.* FROM buckets b WHERE b.owner_id = ${userId} AND NOT EXISTS (SELECT 1 FROM shared_bucket_members sbm WHERE sbm.bucket_id = b.id) ORDER BY b.sort_order ASC, b.created_at DESC`,
    
    lastSynced > 0 
      ? sql`SELECT b.* FROM buckets b JOIN shared_bucket_members sbm ON b.id = sbm.bucket_id WHERE sbm.user_id = ${userId} AND sbm.status = 'accepted' AND b.updated_at >= to_timestamp(${lastSynced} / 1000.0) ORDER BY b.sort_order ASC, b.created_at DESC`
      : sql`SELECT b.* FROM buckets b JOIN shared_bucket_members sbm ON b.id = sbm.bucket_id WHERE sbm.user_id = ${userId} AND sbm.status = 'accepted' ORDER BY b.sort_order ASC, b.created_at DESC`,
    
    lastSynced > 0 
      ? sql`SELECT * FROM habit_logs WHERE owner_id = ${userId} AND updated_at >= to_timestamp(${lastSynced} / 1000.0)`
      : (query.startDate && query.endDate 
          ? sql`SELECT * FROM habit_logs WHERE owner_id = ${userId} AND date >= ${String(query.startDate)} AND date <= ${String(query.endDate)}` 
          : sql`SELECT * FROM habit_logs WHERE owner_id = ${userId}`),
    
    lastSynced > 0 
      ? sql`SELECT * FROM bucket_logs WHERE owner_id = ${userId} AND updated_at >= to_timestamp(${lastSynced} / 1000.0)`
      : (query.startDate && query.endDate 
          ? sql`SELECT * FROM bucket_logs WHERE owner_id = ${userId} AND date >= ${String(query.startDate)} AND date <= ${String(query.endDate)}` 
          : sql`SELECT * FROM bucket_logs WHERE owner_id = ${userId}`),
    
    lastSynced > 0 
      ? sql`SELECT entity_id, entity_type FROM sync_deletions WHERE owner_id = ${userId} AND created_at >= to_timestamp(${lastSynced} / 1000.0)`
      : sql`SELECT entity_id, entity_type FROM sync_deletions WHERE owner_id = ${userId}`
  ]);

  const buckets = [...(personalBuckets as any[]), ...(sharedBuckets as any[])];

  // 3. For buckets, we need their habit mappings and shared metadata too if they changed
  let bucketHabitsResult: any[] = [];
  let sharedMembersResult: any[] = [];
  if (buckets.length > 0) {
    const bucketIds = buckets.map((b: any) => b.id);
    bucketHabitsResult = await sql`
      SELECT bh.*, h.owner_id as habit_owner_id 
      FROM bucket_habits bh
      JOIN habits h ON bh.habit_id = h.id
      WHERE bh.bucket_id = ANY(${bucketIds}::uuid[])
        AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
    `;
    sharedMembersResult = await sql`
      SELECT sbm.*, u.username 
      FROM shared_bucket_members sbm
      JOIN users u ON sbm.user_id = u.id
      WHERE sbm.bucket_id = ANY(${bucketIds}::uuid[])
    `;
  }

  // 4. Normalize and combine
  const normalizedBuckets = buckets.map((b: any) => {
    const habitsForBucket = (bucketHabitsResult as any[]).filter((bh: any) => bh.bucketId === b.id);
    const membersForBucket = (sharedMembersResult as any[]).filter((sbm: any) => sbm.bucketId === b.id);
    
    return normalizeBucket({ 
      ...b, 
      habitIds: habitsForBucket.map((bh: any) => bh.habitId),
      sharedMembers: membersForBucket.map((m: any) => ({
        userId: m.userId,
        username: m.username,
        status: m.status
      })),
      sharedHabits: habitsForBucket.map((bh: any) => ({
        habitId: bh.habitId,
        approvalStatus: bh.approvalStatus,
        addedBy: bh.addedBy,
        habitOwnerId: bh.habitOwnerId
      }))
    });
  });

  // Note: This endpoint does NOT use the { data: ... } wrapper 
  // to maintain exact compatibility with the existing useHabitsApi.ts sync engine.
  return {
    habits: (habits as any[]).map(normalizeHabit),
    buckets: normalizedBuckets,
    habitLogs: (habitLogs as any[]).map(normalizeLog),
    bucketLogs: (bucketLogs as any[]).map(normalizeLog),
    deletions: (deletions as any[]).map((d: any) => ({ id: d.entityId, type: d.entityType })),
    serverTime // This is the checkpoint for the next sync
  };
});
