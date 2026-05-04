import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeHabit, normalizeBucket, normalizeLog } from '../_utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const query = getQuery(event);
  const lastSynced = query.lastSynced ? Number(query.lastSynced) : 0;

  // Get current server time
  const timeRes = await sql`SELECT EXTRACT(EPOCH FROM NOW()) * 1000 as now`;
  const serverTime = Math.floor(Number(timeRes[0]?.now));

  // Fetch deltas in parallel
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

  // Fetch bucket habit mappings
  const bucketIds = buckets.map((b: any) => b.id);
  let bucketHabits: any[] = [];
  if (bucketIds.length > 0) {
    bucketHabits = await sql`
      SELECT * FROM bucket_habits WHERE bucket_id = ANY(${bucketIds}::uuid[])
    `;
  }

  const bucketsWithHabits = buckets.map((b: any) => ({
    ...normalizeBucket(b),
    habitIds: bucketHabits.filter((bh: any) => bh.bucket_id === b.id).map((bh: any) => bh.habit_id)
  }));

  return {
    data: {
      habits: habits.map(normalizeHabit),
      buckets: bucketsWithHabits,
      habitLogs: habitLogs.map(normalizeLog),
      bucketLogs: bucketLogs.map(normalizeLog),
      deletions: deletions.map((d: any) => ({ id: d.entity_id, type: d.entity_type })),
      serverTime
    }
  };
});
