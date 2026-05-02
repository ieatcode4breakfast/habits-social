import { parseISO, startOfDay, subDays, addDays, isAfter, isBefore, format } from 'date-fns';
import type { IHabitLog } from '../../models';
import { usePusher } from '../../utils/pusher';
import { recalculateHabitStreak } from '../../utils/streaks';
import { syncBucketLogsForHabit } from '../../utils/buckets';

// Helper to ensure the date column (which postgres returns as a Date object)
// is always sent to the client as a clean YYYY-MM-DD string.
const normalizeLog = (log: any) => {
  if (!log) return log;
  const normalized = { ...log };
  if (normalized.date) {
    normalized.date = format(new Date(normalized.date), 'yyyy-MM-dd');
  }
  return normalized;
};

const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { ...h };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};

const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { ...b };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};


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
      // Allow up to 1 day in the future (UTC) to accommodate global timezones
      const maxDate = addDays(today, 1);

      if (isBefore(logDate, limitDate) || isAfter(logDate, maxDate)) {
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
    
    return logs.map(normalizeLog);
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

    let finalLog;
    if (existing.length > 0) {
      const existingLog = existing[0]!;
      const newSharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : existingLog.sharedwith;
      
      const result = await sql`
        UPDATE habitlogs
        SET status = ${status}, sharedwith = ${newSharedwith}, updatedat = NOW()
        WHERE id = ${existingLog.id}
        RETURNING *
      `;
      finalLog = result[0];
    } else {
      const logId = body.id || `${habitId}_${dateStr}`;
      const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
      const result = await sql`
        INSERT INTO habitlogs (id, habitid, ownerid, date, status, sharedwith, updatedat)
        VALUES (${logId}, ${habitId}, ${userId}, ${dateStr}, ${status}, ${sharedwith}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          sharedwith = EXCLUDED.sharedwith,
          updatedat = NOW()
        RETURNING *
      `;
      finalLog = result[0];
    }

    const updatedHabit = await recalculateHabitStreak(sql, habitId, userId, dateStr);
    const updatedBuckets = await syncBucketLogsForHabit(sql, habitId, userId, dateStr);

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
    }

    return { 
      log: normalizeLog(finalLog), 
      habit: normalizeHabit(updatedHabit), 
      buckets: updatedBuckets.map(normalizeBucket) 
    };
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
    const updatedBuckets = await syncBucketLogsForHabit(sql, habitId, userId, dateStr);

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
    }

    return { 
      success: true, 
      habit: normalizeHabit(updatedHabit), 
      buckets: updatedBuckets.map(normalizeBucket) 
    };
  }
});



