import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeHabit, normalizeLog } from '~~/server/utils/normalize';

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
      AND ((initiator_id = ${userId} AND receiver_id = ${fId}) 
        OR (initiator_id = ${fId} AND receiver_id = ${userId}))
  `;
  if ((friendshipCheck as any[]).length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You are not friends with this user' });
  }

  const habits = await sql`
    SELECT id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at FROM habits 
    WHERE owner_id = ${fId}
    AND ${String(userId)} = ANY(shared_with)
    ORDER BY sort_order ASC, created_at DESC
  `;

  if ((habits as any[]).length === 0) {
    return { data: { habits: [], logs: [] } };
  }

  const habitIdSet = new Set((habits as any[]).map((h: any) => String(h.id)));

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

  const allLogsRaw = await sql`
    SELECT id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at FROM habit_logs 
    WHERE owner_id = ${fId}
    AND date >= ${startDateStr}
    ${endDateStr ? sql`AND date <= ${endDateStr}` : sql``}
    ORDER BY date DESC
  `;

  const logs = (allLogsRaw as any[]).filter((l: any) => habitIdSet.has(String(l.habitid)));

  return {
    data: {
      habits: (habits as any[]).map(normalizeHabit),
      logs: logs.map(normalizeLog)
    }
  };
});
