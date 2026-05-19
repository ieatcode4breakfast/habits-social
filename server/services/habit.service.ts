import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { habitLogs, habits as habitsTable, bucketHabits, shareEvents, syncDeletions, friendships, users } from '~~/server/db/schema';
import { recalculateHabitStreak } from '~~/server/utils/streaks';
import { syncBucketLogsForHabit, reevaluateMultipleBuckets } from '~~/server/utils/buckets';
import { markBucketHabitsRemoved } from '~~/server/utils/shared-buckets';

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
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: habitLogs.id,
            set: {
              status: data.status,
              sharedWith: data.sharedWith || [],
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

      return result;
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  },

  async createHabit(db: any, userId: string, data: any, event: any) {
    const nextSortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;
    
    let skipsCount = data.skipsCount ?? 2;
    const skipsPeriod = data.skipsPeriod ?? 'weekly';
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount));
    }

    const habitId = data.id || crypto.randomUUID();

    const result = await db.transaction(async (tx: any) => {
      // Lock parent user record to prevent phantom reads
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');

      // Fetch existing habits to check existence and count
      const userHabits = await tx.select({ id: habitsTable.id })
        .from(habitsTable)
        .where(eq(habitsTable.ownerId, userId));
      
      const exists = userHabits.some((h: any) => h.id === habitId);
      
      if (!exists && userHabits.length >= 30) {
        throw createError({ 
          statusCode: 400, 
          statusMessage: 'Habit limit of 30 reached',
          data: { code: 'HABIT_LIMIT_REACHED' } 
        });
      }

      // Friendship Guard: Sanitize sharedWith list
      let sanitizedSharedWith = data.sharedWith || [];
      if (sanitizedSharedWith.length > 0) {
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

      const insertRes = await tx.insert(habitsTable)
        .values({
          id: habitId,
          ownerId: userId,
          title: data.title,
          description: data.description || '',
          skipsCount: skipsCount,
          skipsPeriod: skipsPeriod,
          color: data.color || '#6366f1',
          sharedWith: sanitizedSharedWith,
          sortOrder: nextSortOrder,
          userDate: data.userDate || null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: habitsTable.id,
          set: {
            title: data.title,
            description: data.description || '',
            skipsCount: skipsCount,
            skipsPeriod: skipsPeriod,
            color: data.color || '#6366f1',
            sharedWith: sanitizedSharedWith,
            sortOrder: nextSortOrder,
            userDate: data.userDate || null,
            updatedAt: new Date()
          },
          where: eq(habitsTable.ownerId, userId)
        })
        .returning();

      return insertRes[0];
    });

    if (!result) {
      throw createError({ statusCode: 409, statusMessage: 'Conflict: Habit already exists or ownership mismatch' });
    }

    return result;
  },

  async deleteHabitLog(db: any, userId: string, habitId: string, dateStr: string, event: any) {
    await db.transaction(async (tx: any) => {
      const deleted = await tx.delete(habitLogs)
        .where(and(
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.ownerId, userId),
          eq(habitLogs.date, dateStr)
        ))
        .returning({ id: habitLogs.id, ownerId: habitLogs.ownerId });

      if (deleted.length > 0) {
        await tx.insert(syncDeletions)
          .values({
            id: crypto.randomUUID(),
            ownerId: deleted[0].ownerId,
            entityId: deleted[0].id,
            entityType: 'habit_log',
            createdAt: new Date()
          });
      }

      await recalculateHabitStreak(tx, habitId, userId, dateStr);
      await syncBucketLogsForHabit(tx, habitId, userId, dateStr);
    });
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

    return updatedHabit;
  },

  async deleteHabit(db: any, userId: string, id: string, event: any) {
    await db.transaction(async (tx: any) => {
      // Fetch before delete to verify ownership and get true ownerId for sync attribution
      const records = await tx.select({ ownerId: habitsTable.ownerId })
        .from(habitsTable)
        .where(eq(habitsTable.id, id));
      
      if (records.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Habit not found' });
      }

      const habit = records[0];
      if (habit.ownerId !== userId) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this habit' });
      }

      const bucketsRes = await tx.select({ bucketId: bucketHabits.bucketId })
        .from(bucketHabits)
        .where(eq(bucketHabits.habitId, id));
      
      const bucketIds = bucketsRes.map((b: any) => b.bucketId);
      
      await tx.delete(bucketHabits).where(eq(bucketHabits.habitId, id));
      await tx.delete(habitsTable).where(eq(habitsTable.id, id));
      
      await tx.insert(syncDeletions)
        .values({
          id: crypto.randomUUID(),
          ownerId: habit.ownerId,
          entityId: id,
          entityType: 'habit',
          createdAt: new Date()
        });

      await reevaluateMultipleBuckets(tx, bucketIds.map((id: string) => ({ bucketId: id, ownerId: userId })));
    });
  }
};
