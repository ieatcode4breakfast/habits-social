import { eq, and, or, sql } from 'drizzle-orm';
import { friendships, habits as habitsTable, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { shareHabitSchema, throwZodError } from '~~/server/utils/validation';
import { SocialService } from '~~/server/services/social.service';

type ShareHabitContext = {
  requireAuth?: typeof _requireAuth;
  useDB?: typeof _useDB;
};

export default defineEventHandler(async (event) => {
  const eventContext = event.context as typeof event.context & ShareHabitContext;
  const requireAuth = eventContext.requireAuth ?? _requireAuth;
  const useDB = eventContext.useDB ?? _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const validation = shareHabitSchema.safeParse(body);
  if (!validation.success) return throwZodError(validation.error);

  const { targetUserId, habitId, userDate } = validation.data;
  const targetId = String(targetUserId);

  const [habit] = await db.select({
    id: habitsTable.id,
    sharedWith: habitsTable.sharedWith
  })
    .from(habitsTable)
    .where(and(
      eq(habitsTable.id, habitId),
      eq(habitsTable.ownerId, userId)
    ));

  if (!habit) {
    throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
  }

  if (await SocialService.hasBlockBetween(db, userId, targetId)) {
    throw createError({ statusCode: 403, statusMessage: 'Habit sharing unavailable' });
  }

  const [friendship] = await db.select({ id: friendships.id })
    .from(friendships)
    .where(and(
      eq(friendships.status, 'accepted'),
      or(
        and(eq(friendships.initiatorId, userId), eq(friendships.receiverId, targetId)),
        and(eq(friendships.initiatorId, targetId), eq(friendships.receiverId, userId))
      )
    ));

  if (!friendship) {
    throw createError({ statusCode: 403, statusMessage: 'Active friendship required to share this habit' });
  }

  const alreadyShared = (habit.sharedWith ?? []).map(String).includes(targetId);
  if (alreadyShared) {
    return { data: { success: true, alreadyShared: true } };
  }

  const shared = await db.transaction(async (tx) => {
    if (await SocialService.hasBlockBetween(tx, userId, targetId)) {
      throw createError({ statusCode: 403, statusMessage: 'Habit sharing unavailable' });
    }

    const result = await tx.update(habitsTable)
      .set({
        sharedWith: sql`array_append(COALESCE(${habitsTable.sharedWith}, ARRAY[]::text[]), ${targetId})`,
        updatedAt: new Date()
      })
      .where(and(
        eq(habitsTable.id, habitId),
        eq(habitsTable.ownerId, userId),
        sql`NOT (${targetId}::text = ANY(COALESCE(${habitsTable.sharedWith}, ARRAY[]::text[])))`
      ))
      .returning({ id: habitsTable.id });

    if (result.length > 0 && userDate) {
      await tx.insert(shareEvents)
        .values({
          id: crypto.randomUUID(),
          ownerId: userId,
          recipientId: targetId,
          habitIds: [habitId],
          userDate,
          createdAt: new Date()
        });
    }

    return result.length > 0;
  });

  return { data: { success: true, alreadyShared: !shared } };
});
