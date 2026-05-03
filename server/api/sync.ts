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
  // We use >= to ensure no gaps, client-side 'put' handles duplicates
  const [habits, buckets, habitLogs, bucketLogs, deletions] = await Promise.all([
    sql`
      SELECT * FROM habits 
      WHERE ownerid = ${userId} 
      ${lastSynced > 0 ? sql`AND updatedat >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
      ORDER BY "sortOrder" ASC
    `,
    sql`
      SELECT * FROM buckets 
      WHERE ownerid = ${userId} 
      ${lastSynced > 0 ? sql`AND updatedat >= to_timestamp(${lastSynced} / 1000.0)` : sql``}
      ORDER BY "sortOrder" ASC
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

  // 3. For buckets, we need their habit mappings too if they changed
  // In a truly optimized delta sync, we'd only fetch mappings for changed buckets
  // But for now, we'll fetch mappings for all returned buckets
  let bucketHabits: any[] = [];
  if (buckets.length > 0) {
    const bucketIds = buckets.map((b: any) => b.id);
    bucketHabits = await sql`SELECT bucket_id, habit_id FROM bucket_habits WHERE bucket_id = ANY(${bucketIds}::uuid[])`;
  }

  // 4. Normalize and combine
  const normalizedBuckets = buckets.map((b: any) => {
    const hIds = bucketHabits.filter((bh: any) => bh.bucket_id === b.id).map((bh: any) => bh.habit_id);
    return normalizeBucket({ ...b, habitIds: hIds });
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
