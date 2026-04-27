import type { IHabitLog } from '../../models';
import { usePusher } from '../../utils/pusher';
import { recalculateHabitStreak } from '../../utils/streaks';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

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
      await recalculateHabitStreak(sql, habitId, userId);
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-habits`, 'habit-updated', updatedLog);
      }
      return updatedLog;
    } else {
      const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
      const result = await sql`
        INSERT INTO habitlogs (habitid, ownerid, date, status, sharedwith, updatedat)
        VALUES (${habitId}, ${userId}, ${dateStr}, ${status}, ${sharedwith}, NOW())
        RETURNING *
      `;
      
      const newLog = result[0];
      await recalculateHabitStreak(sql, habitId, userId);
      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-habits`, 'habit-updated', newLog);
      }
      return newLog;
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
    
    await recalculateHabitStreak(sql, habitId, userId);
    
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-deleted', { habitid: habitId, date: dateStr });
    }
    return { success: true };
  }
});
