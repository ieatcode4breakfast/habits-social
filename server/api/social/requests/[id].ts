import { friendships, habits, habitShares } from '../../../models';
import { eq, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  await requireAuth(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    await db.update(friendships)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(friendships.id, id));
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendship = await db.select().from(friendships).where(eq(friendships.id, id)).get();
    if (friendship) {
      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      await db.transaction(async (tx: any) => {
        // Remove shares between these users
        // 1. Find habits owned by u1
        const h1 = await tx.select({ id: habits.id }).from(habits).where(eq(habits.ownerId, u1));
        const h1Ids = h1.map((h: any) => h.id);
        if (h1Ids.length > 0) {
          await tx.delete(habitShares).where(inArray(habitShares.habitId, h1Ids));
        }

        // 2. Find habits owned by u2
        const h2 = await tx.select({ id: habits.id }).from(habits).where(eq(habits.ownerId, u2));
        const h2Ids = h2.map((h: any) => h.id);
        if (h2Ids.length > 0) {
          await tx.delete(habitShares).where(inArray(habitShares.habitId, h2Ids));
        }

        // 3. Delete friendship
        await tx.delete(friendships).where(eq(friendships.id, id));
      });
    }
    return { success: true };
  }
});
