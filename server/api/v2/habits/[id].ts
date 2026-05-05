import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeHabit } from '../_utils/normalize';
import { habitUpdateSchema } from '../_utils/validation';
import { reevaluateBucketLogs } from '../_utils/buckets';
import { markBucketHabitsRemoved } from '../_utils/shared-buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const habits = await sql`SELECT * FROM habits WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (habits.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const habit = habits[0];

  if (event.method === 'GET') {
    return { data: normalizeHabit(habit) };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = habitUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    const title = data.title !== undefined ? data.title : habit.title;
    const description = data.description !== undefined ? data.description : habit.description;
    const color = data.color !== undefined ? data.color : habit.color;
    const sharedwith = data.sharedwith !== undefined ? data.sharedwith : habit.sharedwith;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : habit.sortOrder;
    const user_date = data.user_date !== undefined ? data.user_date : habit.user_date;

    let skipsPeriod = data.skipsPeriod !== undefined ? data.skipsPeriod : habit.skipsPeriod;
    let skipsCount = data.skipsCount !== undefined ? data.skipsCount : habit.skipsCount;
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount));
    }

    const result = await sql`
      UPDATE habits
      SET title = ${title}, description = ${description}, "skipsCount" = ${skipsCount}, "skipsPeriod" = ${skipsPeriod}, color = ${color}, sharedwith = ${sharedwith}, "sortOrder" = ${sortOrder}, user_date = ${user_date}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedHabit = normalizeHabit(result[0]);

    // Detect newly shared recipients and record share events
    const oldSharedSet = new Set((habit.sharedwith || []).map(String));
    const newSharedSet = new Set((sharedwith as string[] || []).map(String));
    
    const newRecipients = (sharedwith as string[] || []).filter((rid: string) => !oldSharedSet.has(String(rid)));
    const removedRecipients = Array.from(oldSharedSet).filter((rid: string) => !newSharedSet.has(String(rid)));

    if (removedRecipients.length > 0) {
      await markBucketHabitsRemoved(sql, [id as string], removedRecipients);
    }

    if (newRecipients.length > 0 && body.user_date) {
      const now = new Date();
      for (const recipientId of newRecipients) {
        await sql`
          INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
          VALUES (${userId}, ${recipientId}, ARRAY[${id}::uuid], ${body.user_date}, ${now})
        `;
      }
    }

    return { data: updatedHabit };
  }

  if (event.method === 'DELETE') {
    const buckets = await sql`SELECT bucket_id FROM bucket_habits WHERE habit_id = ${id}::uuid`;
    const bucketIds = buckets.map(b => b.bucket_id);
    
    await sql`DELETE FROM bucket_habits WHERE habit_id = ${id}::uuid`;
    await sql`DELETE FROM habits WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (ownerid, entity_id, entity_type, created_at) VALUES (${userId}, ${id}::uuid, 'habit', NOW())`;

    for (const bid of bucketIds) {
      await reevaluateBucketLogs(sql, bid, userId);
    }

    return { data: { success: true } };
  }
});
