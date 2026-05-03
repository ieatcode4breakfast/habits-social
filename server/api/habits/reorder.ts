import type { IHabit } from '../../models';
import { usePusher } from '../../utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { ids } = await readBody(event);
  if (!Array.isArray(ids)) throw createError({ statusCode: 400, statusMessage: 'ids must be an array' });

  if (ids.length > 0) {
    await sql.transaction(ids.map((id, index) => 
      sql`UPDATE habits SET "sortOrder" = ${index}, updatedat = NOW() WHERE id = ${id}::uuid AND ownerid = ${userId}`
    ));

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-updated', {});
    }
  }

  return { success: true };
});
