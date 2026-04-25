import type { IFriendship, IHabit, IHabitLog } from '../../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    await sql`
      UPDATE friendships 
      SET status = 'accepted', "updatedAt" = NOW()
      WHERE id = ${id}::uuid
    `;
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendships = await sql`SELECT * FROM friendships WHERE id = ${id}::uuid`;
    if (friendships.length > 0) {
      const friendship = friendships[0];
      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      await sql`UPDATE habits SET sharedwith = array_remove(sharedwith, ${u2}) WHERE ownerid = ${u1}`;
      await sql`UPDATE habitlogs SET sharedwith = array_remove(sharedwith, ${u2}) WHERE ownerid = ${u1}`;
      
      await sql`UPDATE habits SET sharedwith = array_remove(sharedwith, ${u1}) WHERE ownerid = ${u2}`;
      await sql`UPDATE habitlogs SET sharedwith = array_remove(sharedwith, ${u1}) WHERE ownerid = ${u2}`;

      await sql`DELETE FROM friendships WHERE id = ${id}::uuid`;
    }
    return { success: true };
  }
});
