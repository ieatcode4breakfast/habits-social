import { z } from 'zod';
import { parseISO, startOfDay, subDays, addDays, isBefore, isAfter } from 'date-fns';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeLog } from '../_utils/normalize';
import { habitLogSchema } from '../_utils/validation';
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
      logs = await sql`
        SELECT * FROM habitlogs 
        WHERE ownerid = ${userId} 
          AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
      `;
    } else if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT * FROM habitlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT * FROM habitlogs WHERE ownerid = ${userId}`;
    }

    return { data: logs.map(normalizeLog) };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = habitLogSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
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
    const habitCheck = await sql`SELECT id FROM habits WHERE id = ${data.habitid}::uuid AND ownerid = ${userId}`;
    if (habitCheck.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
    }

    const logId = data.id || `${data.habitid}_${data.date}`;

    const result = await sql`
      INSERT INTO habitlogs (id, habitid, ownerid, date, status, sharedwith, "streakCount", "brokenStreakCount", updatedat)
      VALUES (${logId}, ${data.habitid}::uuid, ${userId}, ${data.date}, ${data.status}, ${data.sharedwith}, ${data.streakCount ?? 0}, ${data.brokenStreakCount ?? 0}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        sharedwith = EXCLUDED.sharedwith,
        "streakCount" = EXCLUDED."streakCount",
        "brokenStreakCount" = EXCLUDED."brokenStreakCount",
        updatedat = NOW()
      WHERE habitlogs.ownerid = EXCLUDED.ownerid
      RETURNING *
    `;

    // Recalculate streaks and auto-generate bucket logs server-side
    await recalculateHabitStreak(sql, data.habitid, userId, data.date);
    await syncBucketLogsForHabit(sql, data.habitid, userId, data.date);

    return { data: normalizeLog(result[0]) };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = String(query.habitid || '');
    const dateStr = String(query.date || '');

    if (!habitId || !dateStr) {
      throw createError({ statusCode: 400, statusMessage: 'habitid and date are required' });
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
      DELETE FROM habitlogs 
      WHERE habitid = ${habitId}::uuid AND ownerid = ${userId} AND date = ${dateStr}
    `;

    return { data: { success: true } };
  }
});
