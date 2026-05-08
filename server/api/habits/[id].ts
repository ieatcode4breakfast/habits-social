import { eq, and, sql, inArray } from 'drizzle-orm';
import { habits as habitsTable, bucketHabits, shareEvents, syncDeletions } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeHabit } from '~~/server/utils/normalize';
import { habitUpdateSchema } from '~~/server/utils/validation';
import { reevaluateBucketLogs } from '~~/server/utils/buckets';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const habits = await db.select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, id), eq(habitsTable.ownerId, userId)));

  if (habits.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const habit = habits[0];

  if (event.method === 'GET') {
    return { data: habit };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = habitUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    let skipsPeriod = data.skipsPeriod !== undefined ? data.skipsPeriod : habit.skipsPeriod;
    let skipsCount = data.skipsCount !== undefined ? data.skipsCount : habit.skipsCount;
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount || 0));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount || 0));
    }

    const result = await db.update(habitsTable)
      .set({
        title: data.title ?? habit.title,
        description: data.description ?? habit.description,
        skipsCount: skipsCount,
        skipsPeriod: skipsPeriod,
        color: data.color ?? habit.color,
        sharedWith: data.sharedWith ?? habit.sharedWith,
        sortOrder: data.sortOrder ?? habit.sortOrder,
        userDate: data.userDate ?? habit.userDate,
        updatedAt: new Date()
      })
      .where(eq(habitsTable.id, id))
      .returning();

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedHabit = result[0];

    // Detect newly shared recipients and record share events
    const oldSharedSet = new Set((habit.sharedWith || []).map(String));
    const newSharedSet = new Set((updatedHabit.sharedWith || []).map(String));
    
    const newRecipients = (updatedHabit.sharedWith || []).filter((rid: string) => !oldSharedSet.has(String(rid)));
    const removedRecipients = Array.from(oldSharedSet).filter((rid) => !newSharedSet.has(String(rid))) as string[];

    if (removedRecipients.length > 0) {
      await markBucketHabitsRemoved(db, [id as string], removedRecipients);
    }

    if (newRecipients.length > 0 && updatedHabit.userDate) {
      for (const recipientId of newRecipients) {
        await db.insert(shareEvents)
          .values({
            id: crypto.randomUUID(),
            ownerId: userId,
            recipientId: recipientId,
            habitIds: [id],
            userDate: updatedHabit.userDate,
            createdAt: new Date()
          });
      }
    }

    return { data: updatedHabit };
  }

  if (event.method === 'DELETE') {
    const bucketsRes = await db.select({ bucketId: bucketHabits.bucketId })
      .from(bucketHabits)
      .where(eq(bucketHabits.habitId, id));
    
    const bucketIds = bucketsRes.map((b: any) => b.bucketId);
    
    await db.delete(bucketHabits).where(eq(bucketHabits.habitId, id));
    await db.delete(habitsTable).where(eq(habitsTable.id, id));
    
    await db.insert(syncDeletions)
      .values({
        id: crypto.randomUUID(),
        ownerId: userId,
        entityId: id,
        entityType: 'habit',
        createdAt: new Date()
      });

    for (const bid of bucketIds) {
      await reevaluateBucketLogs(db, bid, userId);
    }

    return { data: { success: true } };
  }
});
