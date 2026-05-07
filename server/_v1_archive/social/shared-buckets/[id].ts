
import { format, subDays } from 'date-fns';
import { usePusher } from '../../_utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  if (event.method === 'GET') {
    // Requires: user is in shared_bucket_members for this bucket
    const members = await sql`
      SELECT sbm.*, u.username 
      FROM shared_bucket_members sbm
      JOIN users u ON sbm.user_id = u.id
      WHERE sbm.bucket_id = ${id}::uuid
    `;
    
    const isMember = members.some((m: any) => m.user_id === userId);
    if (!isMember) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
    }

    const bucketRes = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid`;
    if (bucketRes.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
    const bucket = bucketRes[0];

    // Get all habits in this bucket
    const habits = await sql`
      SELECT bh.*, h.title, h.ownerid as habit_owner_id, u.username as owner_username
      FROM bucket_habits bh
      JOIN habits h ON bh.habit_id = h.id
      JOIN users u ON h.ownerid = u.id
      WHERE bh.bucket_id = ${id}::uuid
        AND (
          bh.approval_status = 'accepted' 
          OR (bh.added_by = ${userId} AND bh.approval_status != 'removed')
          OR (h.ownerid = ${userId} AND bh.approval_status != 'removed')
          OR (${userId} = ${bucket.ownerid})
        )
    `;

    // Get recent logs for accepted habits (last 30 days)
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const acceptedHabitIds = habits.filter((h: any) => h.approval_status === 'accepted').map((h: any) => h.habit_id);
    
    let logs = [];
    if (acceptedHabitIds.length > 0) {
      logs = await sql`
        SELECT * FROM habitlogs 
        WHERE habitid = ANY(${acceptedHabitIds}::uuid[])
          AND date >= ${thirtyDaysAgo}
          AND status != 'cleared'
      `;
    }

    return {
      ...bucket,
      sharedMembers: members.map((m: any) => ({
        userId: m.user_id,
        username: m.username,
        status: m.status
      })),
      sharedHabits: habits.map((h: any) => ({
        habitId: h.habit_id,
        title: h.title,
        approvalStatus: h.approval_status,
        addedBy: h.added_by,
        habitOwnerId: h.habit_owner_id,
        ownerUsername: h.owner_username
      })),
      recentLogs: logs
    };
  }

  if (event.method === 'DELETE') {
    const bucketRes = await sql`SELECT ownerid FROM buckets WHERE id = ${id}::uuid`;
    if (bucketRes.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
    const bucket = bucketRes[0];

    if (bucket.ownerid === userId) {
      // Owner deletes the bucket
      await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
      // Pusher event will be fired to all members
      const pusher = usePusher();
      if (pusher) {
        const members = await sql`SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${id}::uuid`;
        for (const m of members) {
          await pusher.trigger(`user-${m.user_id}-social`, 'shared-bucket-removed', { bucketId: id });
        }
      }
    } else {
      // Participant leaves the bucket
      await sql`
        UPDATE shared_bucket_members 
        SET status = 'declined', updated_at = NOW() 
        WHERE bucket_id = ${id}::uuid AND user_id = ${userId}
      `;
      // Mark their habits as removed
      const myHabits = await sql`
        SELECT habit_id FROM habits WHERE ownerid = ${userId}
      `;
      const myHabitIds = myHabits.map((h: any) => h.id);
      if (myHabitIds.length > 0) {
        await sql`
          UPDATE bucket_habits 
          SET approval_status = 'removed' 
          WHERE bucket_id = ${id}::uuid AND habit_id = ANY(${myHabitIds}::uuid[])
        `;
      }

      const pusher = usePusher();
      if (pusher) {
        const members = await sql`SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${id}::uuid AND status = 'accepted'`;
        for (const m of members) {
          await pusher.trigger(`user-${m.user_id}-social`, 'shared-bucket-removed', { bucketId: id, memberId: userId });
        }
      }
    }

    return { success: true };
  }
});
