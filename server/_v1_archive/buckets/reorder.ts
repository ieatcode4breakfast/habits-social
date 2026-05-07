import { useDB } from '../_utils/db';
import { requireAuth } from '../_utils/auth';
import { usePusher } from '../_utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  if (ids.length > 0) {
    await sql.transaction(ids.map((id, index) => 
      sql`UPDATE buckets SET "sortOrder" = ${index}, updatedat = NOW() WHERE id = ${id}::uuid AND ownerid = ${userId}`
    ));

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', {});
    }
  }

  return { success: true };
});

