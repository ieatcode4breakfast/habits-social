import { eq, and, or, sql, inArray, gte, lte, asc, desc } from 'drizzle-orm';
import { friendships, habits as habitsTable, habitLogs } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeHabit, normalizeLog } from '~~/server/utils/normalize';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const { friendId } = getQuery(event);
  const fId = String(friendId);

  if (!friendId) {
    throw createError({ statusCode: 400, statusMessage: 'friendId is required' });
  }

  // Verify friendship exists and is accepted
  const friendshipCheck = await db.select({ id: friendships.id })
    .from(friendships)
    .where(and(
      eq(friendships.status, 'accepted'),
      or(
        and(eq(friendships.initiatorId, userId), eq(friendships.receiverId, fId)),
        and(eq(friendships.initiatorId, fId), eq(friendships.receiverId, userId))
      )
    ));
  
  if (friendshipCheck.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You are not friends with this user' });
  }

  const habits = await db.select()
    .from(habitsTable)
    .where(and(
      eq(habitsTable.ownerId, fId),
      sql`${userId}::text = ANY(${habitsTable.sharedWith})`
    ))
    .orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt));


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

  const logsQuery = db.select().from(habitLogs).where(and(
    eq(habitLogs.ownerId, fId),
    gte(habitLogs.date, startDateStr)
  ));

  if (endDateStr) {
    logsQuery.where(and(
      eq(habitLogs.ownerId, fId),
      gte(habitLogs.date, startDateStr),
      lte(habitLogs.date, endDateStr)
    ));
  }

  const allLogsRaw = await logsQuery.orderBy(desc(habitLogs.date));

  const logs = allLogsRaw.filter((l: any) => habitIdSet.has(String(l.habitId)));

  return {
    data: {
      habits: habits.map(normalizeHabit),
      logs: logs.map(normalizeLog)
    }
  };
});
