import { parseISO, startOfDay, subDays, addDays, isBefore, isAfter } from 'date-fns';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { habitLogs, habits as habitsTable } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { habitLogSchema, throwZodError } from '~~/server/utils/validation';
import { recalculateHabitStreak } from '~~/server/utils/streaks';
import { syncBucketLogsForHabit } from '~~/server/utils/buckets';

import { HabitService } from '~~/server/services/habit.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    const q = db.select().from(habitLogs).where(eq(habitLogs.ownerId, userId));

    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      q.where(and(eq(habitLogs.ownerId, userId), gte(habitLogs.updatedAt, new Date(lastSynced))));
    } else if (query.startDate && query.endDate) {
      q.where(and(
        eq(habitLogs.ownerId, userId),
        gte(habitLogs.date, String(query.startDate)),
        lte(habitLogs.date, String(query.endDate))
      ));
    }

    const logs = await q;
    return { data: logs };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = habitLogSchema.safeParse(body);
    if (!validation.success) {
      return throwZodError(validation.error);
    }

    const data = validation.data;

    // Validate date is within last 14 days
    const logDate = startOfDay(parseISO(data.date));
    const today = startOfDay(new Date());
    const limitDate = startOfDay(subDays(today, 13));
    const maxDate = addDays(today, 1);

    if (isBefore(logDate, limitDate) || isAfter(logDate, maxDate)) {
      throw createError({ statusCode: 400, statusMessage: 'Habit updates are only allowed for the last 14 days' });
    }

    // Validate habit exists and is owned by user
    const habitCheck = await db.select({ id: habitsTable.id })
      .from(habitsTable)
      .where(and(eq(habitsTable.id, data.habitId), eq(habitsTable.ownerId, userId)));
    
    if (habitCheck.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
    }

    const result = await HabitService.logHabit(db, userId, data, event);

    return { data: result };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = String(query.habitId || '');
    const dateStr = String(query.date || '');

    if (!habitId || !dateStr) {
      throw createError({ statusCode: 400, statusMessage: 'habitId and date are required' });
    }

    // Validate date is within last 14 days
    const logDate = startOfDay(parseISO(dateStr));
    const today = startOfDay(new Date());
    const limitDate = startOfDay(subDays(today, 13));
    const maxDate = addDays(today, 1);

    if (isBefore(logDate, limitDate) || isAfter(logDate, maxDate)) {
      throw createError({ statusCode: 400, statusMessage: 'Habit updates are only allowed for the last 14 days' });
    }

    await HabitService.deleteHabitLog(db, userId, habitId, dateStr, event);

    return { data: { success: true } };
  }
});
