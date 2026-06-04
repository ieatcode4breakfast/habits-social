import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { friendships, habits as habitsTable, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { shareHabitsSchema } from '~~/server/utils/validation';

import { SocialService } from '~~/server/services/social.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const body = await readBody(event);
  const validation = shareHabitsSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { targetUserId, habitIds, userDate } = validation.data;

  const targetId = String(targetUserId);

  if (await SocialService.hasBlockBetween(db, userId, targetId)) {
    throw createError({ statusCode: 403, statusMessage: 'Habit sharing unavailable' });
  }
  
  // Verify friendship exists (accepted or pending)
  const friendshipRes = await db.select({ id: friendships.id })
    .from(friendships)
    .where(and(
      inArray(friendships.status, ['accepted', 'pending']),
      or(
        and(eq(friendships.initiatorId, userId), eq(friendships.receiverId, targetId)),
        and(eq(friendships.initiatorId, targetId), eq(friendships.receiverId, userId))
      )
    ));

  if (friendshipRes.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You can only share habits with friends' });
  }

  // Get currently shared habits for this user/target combo
  const currentShared = await db.select({ id: habitsTable.id })
    .from(habitsTable)
    .where(and(
      eq(habitsTable.ownerId, userId),
      sql`${targetId}::text = ANY(${habitsTable.sharedWith})`
    ));

    
  const currentSharedIds = currentShared.map((h: any) => String(h.id));
  const newSharedIds = habitIds.map((id: string) => String(id));

  const toAdd = newSharedIds.filter((id: string) => !currentSharedIds.includes(id));
  const toRemove = currentSharedIds.filter((id: string) => !newSharedIds.includes(id));

  const actuallySharedIds: string[] = [];

  await db.transaction(async (tx: any) => {
    if (await SocialService.hasBlockBetween(tx, userId, targetId)) {
      throw createError({ statusCode: 403, statusMessage: 'Habit sharing unavailable' });
    }

    // Remove sharing for habits no longer selected
    if (toRemove.length > 0) {
      await tx.update(habitsTable)
        .set({
          sharedWith: sql`array_remove(${habitsTable.sharedWith}, ${targetId})`,
          updatedAt: new Date()
        })
        .where(and(
          inArray(habitsTable.id, toRemove),
          eq(habitsTable.ownerId, userId)
        ));
    }

    // Add sharing for newly selected habits
    if (toAdd.length > 0) {
      const result = await tx.update(habitsTable)
        .set({
          sharedWith: sql`array_append(${habitsTable.sharedWith}, ${targetId})`,
          updatedAt: new Date()
        })
        .where(and(
          inArray(habitsTable.id, toAdd),
          eq(habitsTable.ownerId, userId),
          sql`NOT (${targetId}::text = ANY(${habitsTable.sharedWith}))`
        ))
        .returning({ id: habitsTable.id });
      
      actuallySharedIds.push(...result.map((r: any) => r.id));
    }

    // Record share event for all newly shared habits
    if (actuallySharedIds.length > 0 && userDate) {
      await tx.insert(shareEvents)
        .values({
          id: crypto.randomUUID(),
          ownerId: userId,
          recipientId: targetId,
          habitIds: actuallySharedIds,
          userDate: userDate,
          createdAt: new Date()
        });
    }
  });

  return { data: { success: true } };
});
