import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeBucket } from '../_utils/normalize';
import { bucketUpdateSchema } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const buckets = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (buckets.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const bucket = buckets[0];

  if (event.method === 'GET') {
    const habits = await sql`SELECT habit_id FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
    return { data: { ...normalizeBucket(bucket), habitIds: habits.map((h: any) => h.habit_id) } };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = bucketUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;
    const title = data.title !== undefined ? data.title : bucket.title;
    const description = data.description !== undefined ? data.description : bucket.description;
    const color = data.color !== undefined ? data.color : bucket.color;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : bucket.sortOrder;

    const result = await sql`
      UPDATE buckets
      SET title = ${title}, description = ${description}, color = ${color}, "sortOrder" = ${sortOrder}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedBucket = result[0];

    if (data.habitIds !== undefined) {
      const validHabits = await sql`
        SELECT id FROM habits WHERE id = ANY(${data.habitIds}::uuid[]) AND ownerid = ${userId}
      `;
      const validIds = validHabits.map((h: any) => h.id);

      await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
      for (const hid of validIds) {
        await sql`
          INSERT INTO bucket_habits (bucket_id, habit_id) VALUES (${id}::uuid, ${hid}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const habits = await sql`SELECT habit_id FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
    return { data: { ...normalizeBucket(updatedBucket), habitIds: habits.map((h: any) => h.habit_id) } };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
    return { data: { success: true } };
  }
});
