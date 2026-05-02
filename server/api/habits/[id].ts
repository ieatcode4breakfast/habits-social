import { format } from 'date-fns';
import type { IHabit } from '../../models';
import { usePusher } from '../../utils/pusher';
import { reevaluateBucketLogs } from '../../utils/buckets';

const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { ...h };
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

  const habits = await sql`SELECT * FROM habits WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (habits.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
  const habit = habits[0] as IHabit;

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    const title = body.title !== undefined ? body.title : habit.title;
    const description = body.description !== undefined ? body.description : habit.description;
    const frequencyCount = body.frequencyCount !== undefined ? body.frequencyCount : habit.frequencyCount;
    const frequencyPeriod = body.frequencyPeriod !== undefined ? body.frequencyPeriod : habit.frequencyPeriod;
    const color = body.color !== undefined ? body.color : habit.color;
    const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : habit.sharedwith;

    const result = await sql`
      UPDATE habits
      SET title = ${title}, description = ${description}, "frequencyCount" = ${frequencyCount}, "frequencyPeriod" = ${frequencyPeriod}, color = ${color}, sharedwith = ${sharedwith}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    const updatedHabit = normalizeHabit(result[0]);

    // Category 3: Detect newly shared recipients and record share events
    const oldShared = new Set((habit.sharedwith || []).map(String));
    const newRecipients = (sharedwith as string[]).filter((rid: string) => !oldShared.has(String(rid)));
    if (newRecipients.length > 0 && body.user_date) {
      const now = new Date();
      for (const recipientId of newRecipients) {
        await sql`
          INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
          VALUES (${userId}, ${recipientId}, ARRAY[${id}::uuid], ${body.user_date}, ${now})
        `;
      }
    }

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-updated', { habitId: id });
    }

    return updatedHabit;
  }

  if (event.method === 'DELETE') {
    const buckets = await sql`SELECT bucket_id FROM bucket_habits WHERE habit_id = ${id}::uuid`;
    const bucketIds = buckets.map(b => b.bucket_id);
    
    await sql`DELETE FROM habits WHERE id = ${id}::uuid`;

    for (const bid of bucketIds) {
      await reevaluateBucketLogs(sql, bid, userId);
    }

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-deleted', { habitId: id });
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-needs-refresh', { habitDeleted: true });
    }

    return { success: true };
  }
});
