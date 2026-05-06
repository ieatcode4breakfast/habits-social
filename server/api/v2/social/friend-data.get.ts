import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeHabit, normalizeLog } from '../_utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const { friendId } = getQuery(event);
  const fId = String(friendId);

  if (!friendId) {
    throw createError({ statusCode: 400, statusMessage: 'friendId is required' });
  }

  // Verify friendship exists and is accepted
  const friendshipCheck = await sql`
    SELECT 1 FROM friendships 
    WHERE status = 'accepted'
      AND (("initiatorId" = ${userId} AND "receiverId" = ${fId}) 
        OR ("initiatorId" = ${fId} AND "receiverId" = ${userId}))
  `;
  if (friendshipCheck.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You are not friends with this user' });
  }

  const habits = await sql`
    SELECT id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", "currentStreak", "longestStreak", "streakAnchorDate", user_date, "createdAt", updatedat FROM habits 
    WHERE ownerid = ${fId}
    AND ${String(userId)} = ANY(sharedwith)
    ORDER BY "sortOrder" ASC, "createdAt" DESC
  `;

  if (habits.length === 0) {
    return { data: { habits: [], logs: [] } };
  }

  const habitIdSet = new Set(habits.map((h: any) => String(h.id)));

  const query = getQuery(event);
  let startDateStr = query.startDate ? String(query.startDate) : '';
  let endDateStr = query.endDate ? String(query.endDate) : '';

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDateStr && !dateRegex.test(startDateStr)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid startDate format. Use YYYY-MM-DD' });
  }
  if (endDateStr && !dateRegex.test(endDateStr)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid endDate format. Use YYYY-MM-DD' });
  }

  if (!startDateStr) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    startDateStr = cutoff.toISOString().slice(0, 10);
  }

  const allLogs = await sql`
    SELECT id, habitid, ownerid, date, status, "streakCount", "brokenStreakCount", sharedwith, updatedat FROM habitlogs 
    WHERE ownerid = ${fId}
    AND date >= ${startDateStr}
    ${endDateStr ? sql`AND date <= ${endDateStr}` : sql``}
    ORDER BY date DESC
  `;

  const logs = allLogs.filter((l: any) => habitIdSet.has(String(l.habitid)));

  return {
    data: {
      habits: habits.map(normalizeHabit),
      logs: logs.map(normalizeLog)
    }
  };
});
