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
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  const buckets = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (buckets.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
  const bucket = buckets[0] as IBucket;

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    const title = body.title !== undefined ? body.title : bucket.title;
    const description = body.description !== undefined ? body.description : bucket.description;
    const color = body.color !== undefined ? body.color : bucket.color;
    const sortOrder = body.sortOrder !== undefined ? body.sortOrder : bucket.sortOrder;
    const habitIds = body.habitIds && Array.isArray(body.habitIds) ? body.habitIds : null;

    const result = await sql`
      UPDATE buckets
      SET title = ${title}, description = ${description}, color = ${color}, "sortOrder" = ${sortOrder}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    if (habitIds !== null) {
      await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
      if (habitIds.length > 0) {
        for (const hid of habitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id)
            VALUES (${id}::uuid, ${hid}::uuid)
          `;
        }
      }
      await reevaluateBucketLogs(sql, id as string, userId);
    }

    const updatedBucket = normalizeBucket(result[0]);

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', { bucketId: id });
    }

    return { ...updatedBucket, habitIds: habitIds || [] };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (ownerid, entity_id, entity_type) VALUES (${userId}, ${id}::uuid, 'bucket')`;

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-deleted', { bucketId: id });
    }

    return { success: true };
  }
});
