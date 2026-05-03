import { format } from 'date-fns';
import type { IBucket } from '../../models';
import { usePusher } from '../../utils/pusher';
import { reevaluateBucketLogs } from '../../utils/buckets';

const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { ...b };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    try {
      setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
      const query = getQuery(event);
      let userBuckets;

      if (query.lastSynced) {
        const lastSynced = Number(query.lastSynced);
        userBuckets = await sql`
          SELECT * FROM buckets 
          WHERE ownerid = ${userId} 
            AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
          ORDER BY "sortOrder" ASC, "createdAt" ASC
        `;
      } else {
        userBuckets = await sql`
          SELECT * FROM buckets 
          WHERE ownerid = ${userId} 
          ORDER BY "sortOrder" ASC, "createdAt" ASC
        `;
      }
      
      if (userBuckets.length === 0) return [];

      const bucketIds = userBuckets.map((b: any) => b.id);
      
      // Fetch habit mappings
      const bucketHabits = await sql`SELECT bucket_id, habit_id FROM bucket_habits WHERE bucket_id = ANY(${bucketIds}::uuid[])`;
      
      // Group habits by bucket
      const userBucketsWithHabits = userBuckets.map((b: any) => {
        const habitIds = bucketHabits.filter((bh: any) => bh.bucket_id === b.id).map((bh: any) => bh.habit_id);
        return normalizeBucket({ ...b, habitIds });
      });

      return userBucketsWithHabits;
    } catch (error: any) {
      console.error('[API Buckets GET] Error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Internal Server Error'
      });
    }
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
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          "sortOrder" = EXCLUDED."sortOrder",
          updatedat = NOW()
        RETURNING *
      `;

      const newBucket = result[0];
      if (!newBucket) throw createError({ statusCode: 500, statusMessage: 'Failed to create bucket' });

      // Clear existing mappings before re-inserting (handles updates)
      await sql`DELETE FROM bucket_habits WHERE bucket_id = ${newBucket.id}::uuid`;

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
        await pusher.trigger(`user-${userId}-buckets`, 'sync-settled', { timestamp: Date.now() });
      }

      return normalizeBucket({ ...updatedBucketResult[0], habitIds });
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

