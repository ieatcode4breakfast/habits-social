import { eq, and, or, sql, gte, lte, desc } from 'drizzle-orm';
import { habits as habitsTable, habitLogs } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const { habitId } = getQuery(event);

  if (!habitId) {
    throw createError({ statusCode: 400, statusMessage: 'Habit ID is required' });
  }

  const hIdStr = String(habitId);

  // Fetch habit and check ownership/visibility
  const habitsRes = await db.select()
    .from(habitsTable)
    .where(and(
      eq(habitsTable.id, hIdStr),
      or(
        eq(habitsTable.ownerId, userId),
        sql`${userId}::text = ANY(${habitsTable.sharedWith})`
      )
    ));


  if (habitsRes.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Habit not found or not shared with you' });
  }

  const habit = habitsRes[0];

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

  const conditions = [
    eq(habitLogs.habitId, hIdStr),
    gte(habitLogs.date, startDateStr)
  ];

  if (endDateStr) {
    conditions.push(lte(habitLogs.date, endDateStr));
  }

  const logsQuery = db.select().from(habitLogs).where(and(...conditions));

  const logs = await logsQuery.orderBy(desc(habitLogs.date));

  return {
    data: {
      habit: habit,
      logs: logs
    }
  };
});
