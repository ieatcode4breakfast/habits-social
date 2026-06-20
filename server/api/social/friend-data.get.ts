import { eq, and, or, sql, inArray, gte, lte, asc, desc } from 'drizzle-orm';
import { friendships, habits as habitsTable, habitLogs } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { SocialService } from '~~/server/services/social.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const { friendId, startDate, endDate } = getQuery(event);
  const fId = String(friendId);

  if (!friendId) {
    throw createError({ statusCode: 400, statusMessage: 'friendId is required' });
  }

  if (await SocialService.hasBlockBetween(db, userId, fId)) {
    return { data: { habits: [], logs: [] } };
  }

  let startDateStr = startDate ? String(startDate) : '';
  let endDateStr = endDate ? String(endDate) : '';

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startDateStr && !dateRegex.test(startDateStr)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid startDate format. Use YYYY-MM-DD' });
  }
  if (endDateStr && !dateRegex.test(endDateStr)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid endDate format. Use YYYY-MM-DD' });
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
    return { data: { habits: [], logs: [] } };
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

  const habitIds = habits.map((habit: { id: string }) => habit.id);

  if (!startDateStr) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    startDateStr = cutoff.toISOString().slice(0, 10);
  }

  const logConditions = [
    eq(habitLogs.ownerId, fId),
    inArray(habitLogs.habitId, habitIds),
    gte(habitLogs.date, startDateStr)
  ];

  if (endDateStr) {
    logConditions.push(lte(habitLogs.date, endDateStr));
  }

  const logs = await db.select()
    .from(habitLogs)
    .where(and(...logConditions))
    .orderBy(desc(habitLogs.date));

  return {
    data: {
      habits: habits.map((h: any) => {
        const { sharedWith, ...rest } = h;
        return rest;
      }),
      logs: logs
    }
  };
});
