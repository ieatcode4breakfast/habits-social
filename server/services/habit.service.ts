import { eq, and, sql } from 'drizzle-orm';
import { habitLogs, habits as habitsTable, bucketHabits, shareEvents, syncDeletions } from '~~/server/db/schema';
import { recalculateHabitStreak } from '~~/server/utils/streaks';
import { syncBucketLogsForHabit, reevaluateBucketLogs } from '~~/server/utils/buckets';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';
import { usePusher } from '~~/server/utils/pusher';

export const HabitService = {
  async logHabit(db: any, userId: string, data: any, event: any) {
    const logId = data.id || `${data.habitId}_${data.date}`;

    try {
      const result = await db.insert(habitLogs)
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

      if (!result[0]) {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Habit log already exists or ownership mismatch' });
      }

      await recalculateHabitStreak(db, data.habitId, userId, data.date);
      await syncBucketLogsForHabit(db, data.habitId, userId, data.date);

      const pusher = usePusher(event);
      if (pusher) {
        pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
      }

      return result[0];
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  },

  async deleteHabitLog(db: any, userId: string, habitId: string, dateStr: string, event: any) {
    await db.delete(habitLogs)
      .where(and(
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.ownerId, userId),
        eq(habitLogs.date, dateStr)
      ));

    await recalculateHabitStreak(db, habitId, userId, dateStr);
    await syncBucketLogsForHabit(db, habitId, userId, dateStr);

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

    const result = await db.update(habitsTable)
      .set({
        title: data.title ?? habit.title,
        description: data.description ?? habit.description,
        skipsCount: skipsCount,
        skipsPeriod: skipsPeriod,
        color: data.color ?? habit.color,
        sharedWith: data.sharedWith ?? habit.sharedWith,
        sortOrder: data.sortOrder ?? habit.sortOrder,
        userDate: data.userDate ?? habit.userDate,
        updatedAt: new Date()
      })
      .where(eq(habitsTable.id, id))
      .returning();

    const updatedHabit = result[0];

    // Handle sharing logic
    const oldSharedSet = new Set((habit.sharedWith || []).map(String));
    const newSharedSet = new Set((updatedHabit.sharedWith || []).map(String));
    
    const newRecipients = (updatedHabit.sharedWith || []).filter((rid: string) => !oldSharedSet.has(String(rid)));
    const removedRecipients = Array.from(oldSharedSet).filter((rid) => !newSharedSet.has(String(rid))) as string[];

    if (removedRecipients.length > 0) {
      await markBucketHabitsRemoved(db, [id], removedRecipients);
    }

    if (newRecipients.length > 0 && updatedHabit.userDate) {
      for (const recipientId of newRecipients) {
        await db.insert(shareEvents)
          .values({
            id: crypto.randomUUID(),
            ownerId: userId,
            recipientId: recipientId,
            habitIds: [id],
            userDate: updatedHabit.userDate,
            createdAt: new Date()
          });
      }
    }

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-habits`, 'habit-updated', { habitId: id });
    }

    return updatedHabit;
  },

  async deleteHabit(db: any, userId: string, id: string, event: any) {
    const bucketsRes = await db.select({ bucketId: bucketHabits.bucketId })
      .from(bucketHabits)
      .where(eq(bucketHabits.habitId, id));
    
    const bucketIds = bucketsRes.map((b: any) => b.bucketId);
    
    await db.delete(bucketHabits).where(eq(bucketHabits.habitId, id));
    await db.delete(habitsTable).where(eq(habitsTable.id, id));
    
    await db.insert(syncDeletions)
      .values({
        id: crypto.randomUUID(),
        ownerId: userId,
        entityId: id,
        entityType: 'habit',
        createdAt: new Date()
      });

    for (const bid of bucketIds) {
      await reevaluateBucketLogs(db, bid, userId);
    }

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-habits`, 'habit-deleted', { habitId: id });
    }
  }
};
