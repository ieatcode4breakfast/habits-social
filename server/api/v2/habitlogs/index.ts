import { z } from 'zod';
import { parseISO, startOfDay, subDays, addDays, isBefore, isAfter } from 'date-fns';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeLog } from '../_utils/normalize';
import { habitLogSchema, throwZodError } from '../_utils/validation';
import { recalculateHabitStreak } from '../_utils/streaks';
import { syncBucketLogsForHabit } from '../_utils/buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    let logs;
    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      logs = await sql`
        SELECT id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at FROM habit_logs 
        WHERE owner_id = ${userId} 
          AND updated_at >= to_timestamp(${lastSynced} / 1000.0)
      `;
    } else if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at FROM habit_logs 
        WHERE owner_id = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at FROM habit_logs WHERE owner_id = ${userId}`;
    }

    return { data: (logs as any[]).map(normalizeLog) };
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
    const habitCheck = await sql`SELECT id FROM habits WHERE id = ${data.habitId}::uuid AND owner_id = ${userId}`;
    if ((habitCheck as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
    }

    const logId = data.id || `${data.habitId}_${data.date}`;

    const result = await sql`
      INSERT INTO habit_logs (id, habit_id, owner_id, date, status, shared_with, streak_count, broken_streak_count, updated_at)
      VALUES (${logId}, ${data.habitId}::uuid, ${userId}, ${data.date}, ${data.status}, ${data.sharedWith}, ${data.streakCount ?? 0}, ${data.brokenStreakCount ?? 0}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        shared_with = EXCLUDED.shared_with,
        streak_count = EXCLUDED.streak_count,
        broken_streak_count = EXCLUDED.broken_streak_count,
        updated_at = NOW()
      WHERE habit_logs.owner_id = EXCLUDED.owner_id
      RETURNING id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at
    `;

    // Recalculate streaks and auto-generate bucket logs server-side
    await recalculateHabitStreak(sql, data.habitId, userId, data.date);
    await syncBucketLogsForHabit(sql, data.habitId, userId, data.date);

    return { data: normalizeLog((result as any[])[0]) };
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

    await sql`
      DELETE FROM habit_logs 
      WHERE habit_id = ${habitId}::uuid AND owner_id = ${userId} AND date = ${dateStr}
    `;

    return { data: { success: true } };
  }
});
