import type { IBucket } from '../../models';
import { usePusher } from '../../utils/pusher';
import { reevaluateBucketLogs } from '../../utils/buckets';

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
    const habitIds = body.habitIds;

    const result = await sql`
      UPDATE buckets
      SET title = ${title}, description = ${description}, color = ${color}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    let updatedBucket = result[0];

    // Update habit mappings
    if (habitIds && Array.isArray(habitIds)) {
      await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
      for (const hid of habitIds) {
        await sql`
          INSERT INTO bucket_habits (bucket_id, habit_id)
          VALUES (${id}::uuid, ${hid}::uuid)
        `;
      }
      
      // Re-evaluate logs for this bucket based on the added/removed habits
      await reevaluateBucketLogs(sql, id, userId);
      
      // refetch updated bucket
      const bRes = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid`;
      updatedBucket = bRes[0];
    }

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', { bucketId: id });
    }

    return { ...updatedBucket, habitIds };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-deleted', { bucketId: id });
    }

    return { success: true };
  }
});
