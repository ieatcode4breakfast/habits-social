import { z } from 'zod';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeHabit } from '~~/server/utils/normalize';
import { habitUpdateSchema } from '~~/server/utils/validation';
import { reevaluateBucketLogs } from '~~/server/utils/buckets';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const habits = await sql`SELECT id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at FROM habits WHERE id = ${id}::uuid AND owner_id = ${userId}`;
  if ((habits as any[]).length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const habit = normalizeHabit((habits as any[])[0]);

  if (event.method === 'GET') {
    return { data: habit };
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
    const sharedWith = data.sharedWith !== undefined ? data.sharedWith : habit.sharedWith;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : habit.sortOrder;
    const userDate = data.userDate !== undefined ? data.userDate : habit.userDate;

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
      SET title = ${title}, description = ${description}, skips_count = ${skipsCount}, skips_period = ${skipsPeriod}, color = ${color}, shared_with = ${sharedWith}, sort_order = ${sortOrder}, user_date = ${userDate}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at
    `;

    if ((result as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedHabitData = (result as any[])[0];
    const updatedHabit = normalizeHabit(updatedHabitData);

    // Detect newly shared recipients and record share events
    const oldSharedSet = new Set((habit.sharedWith || []).map(String));
    const newSharedSet = new Set((sharedWith as string[] || []).map(String));
    
    const newRecipients = (sharedWith as string[] || []).filter((rid: string) => !oldSharedSet.has(String(rid)));
    const removedRecipients = Array.from(oldSharedSet).filter((rid) => !newSharedSet.has(String(rid))) as string[];

    if (removedRecipients.length > 0) {
      await markBucketHabitsRemoved(sql, [id as string], removedRecipients);
    }

    if (newRecipients.length > 0 && userDate) {
      const now = new Date();
      for (const recipientId of newRecipients) {
        await sql`
          INSERT INTO share_events (owner_id, recipient_id, habit_ids, user_date, created_at)
          VALUES (${userId}, ${recipientId}, ARRAY[${id}::uuid], ${userDate}, ${now})
        `;
      }
    }

    return { data: updatedHabit };
  }

  if (event.method === 'DELETE') {
    const buckets = await sql`SELECT bucket_id FROM bucket_habits WHERE habit_id = ${id}::uuid`;
    const bucketIds = (buckets as any[]).map((b: any) => b.bucketId);
    
    await sql`DELETE FROM bucket_habits WHERE habit_id = ${id}::uuid`;
    await sql`DELETE FROM habits WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (owner_id, entity_id, entity_type, created_at) VALUES (${userId}, ${id}::uuid, 'habit', NOW())`;

    for (const bid of bucketIds) {
      await reevaluateBucketLogs(sql, bid, userId);
    }

    return { data: { success: true } };
  }
});
