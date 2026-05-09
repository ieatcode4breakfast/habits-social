import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { habitLogs, habits as habitsTable, bucketHabits, shareEvents, syncDeletions, friendships } from '~~/server/db/schema';
import { recalculateHabitStreak } from '~~/server/utils/streaks';
import { syncBucketLogsForHabit, reevaluateMultipleBuckets } from '~~/server/utils/buckets';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';
import { usePusher } from '~~/server/utils/pusher';

export const HabitService = {
  async logHabit(db: any, userId: string, data: any, event: any) {
    const logId = data.id || `${data.habitId}_${data.date}`;

    try {
      const result = await db.transaction(async (tx: any) => {
        const insertRes = await tx.insert(habitLogs)
          .values({
            id: logId,
            habitId: data.habitId,
            ownerId: userId,
            date: data.date,
            status: data.status,
            sharedWith: data.sharedWith || [],
            streakCount: data.streakCount ?? 0,
            brokenStreakCount: data.brokenStreakCount ?? 0,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: habitLogs.id,
            set: {
              status: data.status,
              sharedWith: data.sharedWith || [],
              streakCount: data.streakCount ?? 0,
              brokenStreakCount: data.brokenStreakCount ?? 0,
              updatedAt: new Date()
            },
            where: eq(habitLogs.ownerId, userId)
          })
          .returning();

        if (!insertRes[0]) {
          throw createError({ statusCode: 409, statusMessage: 'Conflict: Habit log already exists or ownership mismatch' });
        }

        await recalculateHabitStreak(tx, data.habitId, userId, data.date);
        await syncBucketLogsForHabit(tx, data.habitId, userId, data.date);

        return insertRes[0];
      });

      const pusher = usePusher(event);
      if (pusher) {
        pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
      }

      return result;
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  },

  async deleteHabitLog(db: any, userId: string, habitId: string, dateStr: string, event: any) {
    await db.transaction(async (tx: any) => {
      await tx.delete(habitLogs)
        .where(and(
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.ownerId, userId),
          eq(habitLogs.date, dateStr)
        ));

      await recalculateHabitStreak(tx, habitId, userId, dateStr);
      await syncBucketLogsForHabit(tx, habitId, userId, dateStr);
    });

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
    }
  },

  async updateHabit(db: any, userId: string, id: string, data: any, habit: any, event: any) {
    let skipsPeriod = data.skipsPeriod !== undefined ? data.skipsPeriod : habit.skipsPeriod;
    let skipsCount = data.skipsCount !== undefined ? data.skipsCount : habit.skipsCount;
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount || 0));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount || 0));
    }

    const updatedHabit = await db.transaction(async (tx: any) => {
      // Friendship Guard: Sanitize sharedWith list
      let sanitizedSharedWith = data.sharedWith;
      if (sanitizedSharedWith && sanitizedSharedWith.length > 0) {
        const friendshipsRes = await tx.select()
          .from(friendships)
          .where(and(
            inArray(friendships.status, ['accepted', 'pending']),
            or(
              and(eq(friendships.initiatorId, userId), inArray(friendships.receiverId, sanitizedSharedWith)),
              and(eq(friendships.receiverId, userId), inArray(friendships.initiatorId, sanitizedSharedWith))
            )
          ));
        
        const validFriendIds = new Set(friendshipsRes.map((f: any) => 
          f.initiatorId === userId ? f.receiverId : f.initiatorId
        ));
        
        sanitizedSharedWith = sanitizedSharedWith.filter((rid: string) => validFriendIds.has(rid));
      }

      const result = await tx.update(habitsTable)
        .set({
          title: data.title ?? habit.title,
          description: data.description ?? habit.description,
          skipsCount: skipsCount,
          skipsPeriod: skipsPeriod,
          color: data.color ?? habit.color,
          sharedWith: sanitizedSharedWith ?? habit.sharedWith,
          sortOrder: data.sortOrder ?? habit.sortOrder,
          userDate: data.userDate ?? habit.userDate,
          updatedAt: new Date()
        })
        .where(and(
          eq(habitsTable.id, id),
          eq(habitsTable.ownerId, userId)
        ))
        .returning();

      if (result.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Habit not found or ownership mismatch' });
      }

      const updated = result[0];

      // Handle sharing logic
      const oldSharedSet = new Set((habit.sharedWith || []).map(String));
      const newSharedSet = new Set((updated.sharedWith || []).map(String));
      
      const newRecipients = (updated.sharedWith || []).filter((rid: string) => !oldSharedSet.has(String(rid)));
      const removedRecipients = Array.from(oldSharedSet).filter((rid) => !newSharedSet.has(String(rid))) as string[];

      if (removedRecipients.length > 0) {
        await markBucketHabitsRemoved(tx, [id], removedRecipients);
      }

      if (newRecipients.length > 0 && updated.userDate) {
        await tx.insert(shareEvents)
          .values(newRecipients.map((recipientId: string) => ({
            id: crypto.randomUUID(),
            ownerId: userId,
            recipientId: recipientId,
            habitIds: [id],
            userDate: updated.userDate!,
            createdAt: new Date()
          })));
      }
      return updated;
    });

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-habits`, 'habit-updated', { habitId: id });
    }

    return updatedHabit;
  },

  async deleteHabit(db: any, userId: string, id: string, event: any) {
    await db.transaction(async (tx: any) => {
      const bucketsRes = await tx.select({ bucketId: bucketHabits.bucketId })
        .from(bucketHabits)
        .where(eq(bucketHabits.habitId, id));
      
      const bucketIds = bucketsRes.map((b: any) => b.bucketId);
      
      await tx.delete(bucketHabits).where(eq(bucketHabits.habitId, id));
      await tx.delete(habitsTable).where(eq(habitsTable.id, id));
      
      await tx.insert(syncDeletions)
        .values({
          id: crypto.randomUUID(),
          ownerId: userId,
          entityId: id,
          entityType: 'habit',
          createdAt: new Date()
        });

      await reevaluateMultipleBuckets(tx, bucketIds.map((id: string) => ({ bucketId: id, ownerId: userId })));
    });

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-habits`, 'habit-deleted', { habitId: id });
    }
  }
};
