import { habits, habitShares } from '../../models';
import { eq, asc, count as drizzleCount } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const userHabits = await db.select().from(habits)
      .where(eq(habits.ownerId, userId))
      .orderBy(asc(habits.sortOrder), asc(habits.createdAt));
    
    // Fetch shares for each habit
    const results = await Promise.all(userHabits.map(async (habit) => {
      const shares = await db.select().from(habitShares).where(eq(habitShares.habitId, habit.id));
      return {
        ...habit,
        sharedwith: shares.map(s => s.userId)
      };
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    // Get count for sortOrder
    const [stats] = await db.select({ value: drizzleCount() }).from(habits).where(eq(habits.ownerId, userId));
    const nextSortOrder = stats?.value || 0;

    const newHabit = await db.transaction(async (tx) => {
      const created = await tx.insert(habits).values({
        ownerId: userId,
        title: body.title,
        description: body.description || '',
        frequencyCount: body.frequencyCount || 1,
        frequencyPeriod: body.frequencyPeriod || 'daily',
        color: body.color || '#6366f1',
        sortOrder: nextSortOrder,
      }).returning().get();

      if (body.sharedwith && Array.isArray(body.sharedwith)) {
        for (const sharedUserId of body.sharedwith) {
          await tx.insert(habitShares).values({
            habitId: created.id,
            userId: Number(sharedUserId),
          });
        }
      }

      return created;
    });

    return { ...newHabit, sharedwith: body.sharedwith || [] };
  }
});
