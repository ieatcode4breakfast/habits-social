import type { IBucket } from '../../models';
import { usePusher } from '../../utils/pusher';
import { reevaluateBucketLogs } from '../../utils/buckets';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const userBuckets = await sql`SELECT * FROM buckets WHERE ownerid = ${userId} ORDER BY "sortOrder" ASC, "createdAt" ASC`;
    
    if (userBuckets.length === 0) return [];

    const bucketIds = userBuckets.map((b: any) => b.id);
    
    // Fetch habit mappings
    const bucketHabits = await sql`SELECT bucket_id, habit_id FROM bucket_habits WHERE bucket_id = ANY(${bucketIds}::uuid[])`;
    
    // Group habits by bucket
    const userBucketsWithHabits = userBuckets.map((b: any) => {
      const habitIds = bucketHabits.filter((bh: any) => bh.bucket_id === b.id).map((bh: any) => bh.habit_id);
      return { ...b, habitIds };
    });

    return userBucketsWithHabits;
  }

  if (event.method === 'POST') {
    try {
      const body = await readBody(event);
      
      const countResult = await sql`SELECT COUNT(*) FROM buckets WHERE ownerid = ${userId}`;
      const nextSortOrder = parseInt(countResult[0]?.count) || 0;

      if (nextSortOrder >= 30) {
        throw createError({ statusCode: 400, statusMessage: 'Bucket limit of 30 reached' });
      }

      const title = body.title;
      const description = body.description || '';
      const color = body.color || '#6366f1';
      const habitIds = body.habitIds && Array.isArray(body.habitIds) ? body.habitIds : [];

      const result = await sql`
        INSERT INTO buckets (id, ownerid, title, description, color, "sortOrder", "createdAt", updatedat)
        VALUES (${body.id ? body.id : sql`DEFAULT`}, ${userId}, ${title}, ${description}, ${color}, ${nextSortOrder}, NOW(), NOW())
        RETURNING *
      `;

      const newBucket = result[0];
      if (!newBucket) throw createError({ statusCode: 500, statusMessage: 'Failed to create bucket' });

      // Insert habit mappings
      if (habitIds.length > 0) {
        for (const hid of habitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id)
            VALUES (${newBucket.id}::uuid, ${hid}::uuid)
          `;
        }
        
        // Re-evaluate logs for this bucket based on the added habits
        await reevaluateBucketLogs(sql, newBucket.id, userId);
      }
      
      // fetch again to get updated streaks
      const updatedBucketResult = await sql`SELECT * FROM buckets WHERE id = ${newBucket.id}`;

      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', { bucketId: newBucket.id });
      }

      return { ...updatedBucketResult[0], habitIds };
    } catch (error: any) {
      console.error('[API Buckets POST] Error:', error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: error.message || 'Internal Server Error',
        data: error
      });
    }
  }
});
