import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { normalizeHabit, normalizeLog } from '../../utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const { habitId } = getQuery(event);

  if (!habitId) {
    throw createError({ statusCode: 400, statusMessage: 'Habit ID is required' });
  }

  const uIdStr = String(userId);
  const hIdStr = String(habitId);

  // Fetch habit and check ownership/visibility
  const habits = await sql`
    SELECT id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at FROM habits 
    WHERE id = ${hIdStr}
    AND (owner_id = ${uIdStr} OR ${uIdStr} = ANY(shared_with))
  `;

  if ((habits as any[]).length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Habit not found or not shared with you' });
  }

  const habit = (habits as any[])[0];

  // Fetch logs. Default to last 60 days if no range provided.
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
    cutoff.setDate(cutoff.getDate() - 60);
    startDateStr = cutoff.toISOString().slice(0, 10);
  }

  const logs = await sql`
    SELECT id, habit_id, owner_id, date, status, streak_count, broken_streak_count, shared_with, updated_at FROM habit_logs 
    WHERE habit_id = ${hIdStr}
    AND date >= ${startDateStr}
    ${endDateStr ? sql`AND date <= ${endDateStr}` : sql``}
    ORDER BY date DESC
  `;

  return {
    data: {
      habit: normalizeHabit(habit),
      logs: (logs as any[]).map(normalizeLog)
    }
  };
});
