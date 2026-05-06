import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeBucket } from '../_utils/normalize';
import { bucketSchema, throwZodError } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    let buckets;
    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      buckets = await sql`
        SELECT id, owner_id, title, description, color, sort_order, current_streak, longest_streak, streak_anchor_date, created_at, updated_at FROM buckets 
        WHERE owner_id = ${userId} 
          AND updated_at >= to_timestamp(${lastSynced} / 1000.0)
        ORDER BY sort_order ASC, created_at DESC
      `;
    } else {
      buckets = await sql`
        SELECT id, owner_id, title, description, color, sort_order, current_streak, longest_streak, streak_anchor_date, created_at, updated_at FROM buckets 
        WHERE owner_id = ${userId} 
        ORDER BY sort_order ASC, created_at DESC
      `;
    }

    if ((buckets as any[]).length === 0) return { data: [] };

    const bucketIds = (buckets as any[]).map((b: any) => b.id);
    const bucketHabits = await sql`
      SELECT bucket_id, habit_id FROM bucket_habits WHERE bucket_id = ANY(${bucketIds}::uuid[])
    `;

    const bucketsWithHabits = (buckets as any[]).map((b: any) => ({
      ...normalizeBucket(b),
      habitIds: (bucketHabits as any[]).filter((bh: any) => bh.bucket_id === b.id).map((bh: any) => bh.habit_id)
    }));

    return { data: bucketsWithHabits };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = bucketSchema.safeParse(body);
    if (!validation.success) {
      return throwZodError(validation.error);
    }

    const data = validation.data;
    const nextSortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Bucket limit of 30 reached' });
    }


    const result = await sql`
      INSERT INTO buckets (id, owner_id, title, description, color, sort_order, created_at, updated_at)
      VALUES (COALESCE(${data.id}::uuid, gen_random_uuid()), ${userId}, ${data.title}, ${data.description}, ${data.color}, ${nextSortOrder}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      WHERE buckets.owner_id = EXCLUDED.owner_id
      RETURNING id, owner_id, title, description, color, sort_order, current_streak, longest_streak, streak_anchor_date, created_at, updated_at
    `;

    const newBucket = (result as any[])[0];
    if (!newBucket) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create bucket' });
    }

    // Manage bucket_habits
    if (data.habitIds && data.habitIds.length > 0) {
      // Validate habits exist and belong to user
      const validHabits = await sql`
        SELECT id FROM habits WHERE id = ANY(${data.habitIds}::uuid[]) AND owner_id = ${userId}
      `;
      const validIds = (validHabits as any[]).map((h: any) => h.id);

      await sql`DELETE FROM bucket_habits WHERE bucket_id = ${newBucket.id}::uuid`;
      for (const hid of validIds) {
        await sql`
          INSERT INTO bucket_habits (bucket_id, habit_id) VALUES (${newBucket.id}::uuid, ${hid}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const habitsData = await sql`SELECT habit_id FROM bucket_habits WHERE bucket_id = ${newBucket.id}::uuid`;
    return { data: { ...normalizeBucket(newBucket), habitIds: (habitsData as any[]).map((h: any) => h.habit_id) } };
  }
});
