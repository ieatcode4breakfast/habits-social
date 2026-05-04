import { normalizeHabit, normalizeBucket, normalizeLog } from '../utils/normalize';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const query = getQuery(event);
  
  // Use a numeric timestamp in ms (epoch)
  const lastSynced = query.lastSynced ? Number(query.lastSynced) : 0;

  // 1. Get the current authoritative server time from the database
  const timeRes = await sql`SELECT EXTRACT(EPOCH FROM NOW()) * 1000 as now`;
  const firstRow = timeRes?.[0];
  if (!firstRow) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get server time' });
  }
  const serverTime = Math.floor(Number(firstRow.now));

  // 2. Fetch all deltas in parallel
  const [habits, personalBuckets, sharedBuckets, habitLogs, bucketLogs, deletions] = await Promise.all([
    sql`
      SELECT * FROM habits 
      WHERE ownerid = ${userId} 
      ${lastSynced > 0 ? sql`AND updatedat >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
      ORDER BY "sortOrder" ASC
    `,
    sql`
      SELECT b.* FROM buckets b
      WHERE b.ownerid = ${userId} 
        AND NOT EXISTS (SELECT 1 FROM shared_bucket_members sbm WHERE sbm.bucket_id = b.id)
        ${lastSynced > 0 ? sql`AND b.updatedat >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
      ORDER BY b."sortOrder" ASC
    `,
    sql`
      SELECT b.* FROM buckets b
      JOIN shared_bucket_members sbm ON b.id = sbm.bucket_id
      WHERE sbm.user_id = ${userId}
        AND sbm.status = 'accepted'
        ${lastSynced > 0 ? sql`AND b.updatedat >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
      ORDER BY b."sortOrder" ASC
    `,
    sql`
      SELECT * FROM habitlogs 
      WHERE ownerid = ${userId} 
      ${lastSynced > 0 
        ? sql`AND updatedat >= to_timestamp(${lastSynced} / 1000.0)` 
        : (query.startDate && query.endDate 
            ? sql`AND date >= ${String(query.startDate)} AND date <= ${String(query.endDate)}` 
            : sql``)}
    `,
    sql`
      SELECT * FROM bucketlogs 
      WHERE ownerid = ${userId} 
      ${lastSynced > 0 
        ? sql`AND updatedat >= to_timestamp(${lastSynced} / 1000.0)` 
        : (query.startDate && query.endDate 
            ? sql`AND date >= ${String(query.startDate)} AND date <= ${String(query.endDate)}` 
            : sql``)}
    `,
    sql`
      SELECT entity_id, entity_type FROM sync_deletions
      WHERE ownerid = ${userId}
      ${lastSynced > 0 ? sql`AND created_at >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
    `
  ]);

  const buckets = [...personalBuckets, ...sharedBuckets];

  // 3. For buckets, we need their habit mappings and shared metadata too if they changed
  let bucketHabits: any[] = [];
  let sharedMembers: any[] = [];
  if (buckets.length > 0) {
    const bucketIds = buckets.map((b: any) => b.id);
    bucketHabits = await sql`
      SELECT bh.*, h.ownerid as habit_owner_id 
      FROM bucket_habits bh
      JOIN habits h ON bh.habit_id = h.id
      WHERE bh.bucket_id = ANY(${bucketIds}::uuid[])
        AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
    `;
    sharedMembers = await sql`
      SELECT sbm.*, u.username 
      FROM shared_bucket_members sbm
      JOIN users u ON sbm.user_id = u.id
      WHERE sbm.bucket_id = ANY(${bucketIds}::uuid[])
    `;
  }

  // 4. Normalize and combine
  const normalizedBuckets = buckets.map((b: any) => {
    const habits = bucketHabits.filter((bh: any) => bh.bucket_id === b.id);
    const members = sharedMembers.filter((sbm: any) => sbm.bucket_id === b.id);
    
    return normalizeBucket({ 
      ...b, 
      habitIds: habits.map((bh: any) => bh.habit_id),
      sharedMembers: members.map((m: any) => ({
        userId: m.user_id,
        username: m.username,
        status: m.status
      })),
      sharedHabits: habits.map((bh: any) => ({
        habitId: bh.habit_id,
        approvalStatus: bh.approval_status,
        addedBy: bh.added_by,
        habitOwnerId: bh.habit_owner_id
      }))
    });
  });

  return {
    habits: habits.map(normalizeHabit),
    buckets: normalizedBuckets,
    habitLogs: habitLogs.map(normalizeLog),
    bucketLogs: bucketLogs.map(normalizeLog),
    deletions: deletions.map((d: any) => ({ id: d.entity_id, type: d.entity_type })),
    serverTime // This is the checkpoint for the next sync
  };
});
