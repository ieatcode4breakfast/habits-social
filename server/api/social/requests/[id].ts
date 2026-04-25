import type { IFriendship, IHabit, IHabitLog } from '../../../models';
import { usePusher } from '../../../utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    const updated = await sql`
      UPDATE friendships 
      SET status = 'accepted', "updatedAt" = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;
    if (updated.length > 0) {
      const friendship = updated[0]!;
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${friendship.initiatorId}-social`, 'friend-request-accepted', friendship);
        await pusher.trigger(`user-${friendship.receiverId}-social`, 'friend-request-accepted', friendship);
      }
    }
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendshipsList = await sql`SELECT * FROM friendships WHERE id = ${id}::uuid`;
    if (friendshipsList.length > 0) {
      const friendship = friendshipsList[0]!;
      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      await sql`UPDATE habits SET sharedwith = array_remove(sharedwith, ${u2}) WHERE ownerid = ${u1}`;
      await sql`UPDATE habitlogs SET sharedwith = array_remove(sharedwith, ${u1}) WHERE ownerid = ${u2}`;

      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
      
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${u1}-social`, 'friendship-removed', { id });
        await pusher.trigger(`user-${u2}-social`, 'friendship-removed', { id });
      }
    }
    return { success: true };
  }
});
