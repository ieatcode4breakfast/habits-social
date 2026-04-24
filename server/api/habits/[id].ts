import { habits, habitShares } from '../../models';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = requireAuth(event);
  const id = Number(getRouterParam(event, 'id'));

  const habit = await db.select().from(habits).where(and(eq(habits.id, id), eq(habits.ownerId, userId))).get();
  if (!habit) throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    await db.transaction(async (tx) => {
      await tx.update(habits).set({
        title: body.title,
        description: body.description,
        frequencyCount: body.frequencyCount,
        frequencyPeriod: body.frequencyPeriod,
        color: body.color,
        updatedAt: new Date(),
      }).where(eq(habits.id, id));

      if (body.sharedwith && Array.isArray(body.sharedwith)) {
        // Sync shares: delete old, insert new
        await tx.delete(habitShares).where(eq(habitShares.habitId, id));
        for (const sharedUserId of body.sharedwith) {
          await tx.insert(habitShares).values({
            habitId: id,
            userId: Number(sharedUserId),
          });
        }
      }
    });

    return { success: true };
  }

  if (event.method === 'DELETE') {
    await db.transaction(async (tx) => {
      await tx.delete(habitShares).where(eq(habitShares.habitId, id));
      await tx.delete(habits).where(eq(habits.id, id));
    });
    return { success: true };
  }
});
