
import { usePusher } from '../../../../utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  if (event.method === 'PUT') {
    // Changes shared_bucket_members.status from 'pending' to 'accepted'
    const result = await sql`
      UPDATE shared_bucket_members 
      SET status = 'accepted', updated_at = NOW() 
      WHERE bucket_id = ${id}::uuid AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Invitation not found' });
    }

    const pusher = usePusher();
    if (pusher) {
      const members = await sql`SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${id}::uuid AND status = 'accepted'`;
      for (const m of members) {
        await pusher.trigger(`user-${m.user_id}-social`, 'shared-bucket-member-joined', { 
          bucketId: id, 
          userId 
        });
      }
    }

    return { success: true };
  }
});
