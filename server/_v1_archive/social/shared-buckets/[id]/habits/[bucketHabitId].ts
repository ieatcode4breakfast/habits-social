
import { usePusher } from '../../../../_utils/pusher';
import { reevaluateBucketLogs } from '../../../../_utils/buckets';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const bucketId = getRouterParam(event, 'id');
  const habitId = getRouterParam(event, 'bucketHabitId');

  if (!bucketId || !habitId) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const status = body.status; // 'accepted' | 'declined' | 'removed'

    if (!['accepted', 'declined', 'removed'].includes(status)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' });
    }

    // Only the habit's owner can call this
    const habitRes = await sql`
      SELECT ownerid FROM habits WHERE id = ${habitId}::uuid
    `;
    if (habitRes.length === 0) throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
    if (habitRes[0].ownerid !== userId) throw createError({ statusCode: 403, statusMessage: 'Forbidden' });

    await sql`
      UPDATE bucket_habits 
      SET approval_status = ${status} 
      WHERE bucket_id = ${bucketId}::uuid AND habit_id = ${habitId}::uuid
    `;

    // Re-evaluate logs if status changed to/from accepted
    await reevaluateBucketLogs(sql, bucketId, userId);

    const pusher = usePusher();
    if (pusher) {
      const members = await sql`SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${bucketId}::uuid AND status = 'accepted'`;
      for (const m of members) {
        await pusher.trigger(`user-${m.user_id}-social`, 'shared-bucket-updated', { 
          bucketId, 
          habitId, 
          status 
        });
      }
    }

    return { success: true };
  }
});
