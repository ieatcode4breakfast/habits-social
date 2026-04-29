import { parseISO, startOfDay, subDays, isAfter, isBefore } from 'date-fns';
import type { IHabitLog } from '../../models';
import { usePusher } from '../../utils/pusher';
import { recalculateHabitStreak } from '../../utils/streaks';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  // Validation: Only allow updates for the last 14 days
  if (event.method === 'POST' || event.method === 'DELETE') {
    let dateStr = '';
    if (event.method === 'POST') {
      const body = await readBody(event);
      dateStr = String(body.date);
      // Re-read body later if needed, or just use the parsed one.
      // Nitro's readBody can be called multiple times if cached, but let's be safe.
      event.context.body = body; 
    } else {
      const query = getQuery(event);
      dateStr = String(query.date);
    }

    if (dateStr) {
      const logDate = startOfDay(parseISO(dateStr));
      const today = startOfDay(new Date());
      const limitDate = startOfDay(subDays(today, 13));

      if (isBefore(logDate, limitDate) || isAfter(logDate, today)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Habit updates are only allowed for the last 14 days.'
        });
      }
    }
  }

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);
    
    let logs;
    if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT * FROM habitlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT * FROM habitlogs WHERE ownerid = ${userId}`;
    }
    
    return logs;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habitId = String(body.habitid);
    const dateStr = String(body.date);
    const status = String(body.status);

    const existing = await sql`
      SELECT * FROM habitlogs 
      WHERE habitid = ${habitId} AND ownerid = ${userId} AND date = ${dateStr}
    `;

    if (existing.length > 0) {
      const existingLog = existing[0]!;
      const newSharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : existingLog.sharedwith;
      
      const result = await sql`
        UPDATE habitlogs
        SET status = ${status}, sharedwith = ${newSharedwith}, updatedat = NOW()
        WHERE id = ${existingLog.id}
        RETURNING *
      `;
      
      const updatedLog = result[0];
      const updatedHabit = await recalculateHabitStreak(sql, habitId, userId, dateStr);
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-habits`, 'habit-updated', { log: updatedLog, habit: updatedHabit });
      }
      return { log: updatedLog, habit: updatedHabit };
    } else {
      const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
      const result = await sql`
        INSERT INTO habitlogs (habitid, ownerid, date, status, sharedwith, updatedat)
        VALUES (${habitId}, ${userId}, ${dateStr}, ${status}, ${sharedwith}, NOW())
        RETURNING *
      `;
      
      const newLog = result[0];
      const updatedHabit = await recalculateHabitStreak(sql, habitId, userId, dateStr);
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-habits`, 'habit-updated', { log: newLog, habit: updatedHabit });
      }
      return { log: newLog, habit: updatedHabit };
    }
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = String(query.habitid);
    const dateStr = String(query.date);
    
    await sql`
      DELETE FROM habitlogs 
      WHERE habitid = ${habitId} AND ownerid = ${userId} AND date = ${dateStr}
    `;
    
    const updatedHabit = await recalculateHabitStreak(sql, habitId, userId, dateStr);
    
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-deleted', { habitid: habitId, date: dateStr, habit: updatedHabit });
    }
    return { success: true, habit: updatedHabit };
  }
});
