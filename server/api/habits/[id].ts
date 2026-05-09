import { eq, and, sql, inArray } from 'drizzle-orm';
import { habits as habitsTable, bucketHabits, shareEvents, syncDeletions } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { habitUpdateSchema } from '~~/server/utils/validation';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';

import { HabitService } from '~~/server/services/habit.service';

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

    const updatedHabit = await HabitService.updateHabit(db, userId, id, validation.data, habit, event);

    return { data: updatedHabit };
  }

  if (event.method === 'DELETE') {
    await HabitService.deleteHabit(db, userId, id, event);
    return { data: { success: true } };
  }
});
