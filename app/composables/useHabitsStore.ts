import { db } from '~/utils/db';
import { recalculateLocalHabitStreak, recalculateLocalBucketStreak } from '~/utils/streaks';

export const useHabitsStore = () => {
  const { user } = useAuth();
  const getOwnerId = () => user.value?.id || '';

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const toPlain = (obj: any) => JSON.parse(JSON.stringify(obj));

  // --- Habits ---
  const getHabits = async () => {
    const habits = await db.habits.where('ownerId').equals(getOwnerId()).toArray();
    return habits.sort((a, b) => {
      const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const putHabit = async (habit: any) => {
    await db.habits.put(toPlain(habit));
  };

  const deleteHabit = async (id: string) => {
    await db.habits.delete(id);
    await db.habitLogs.where({ habitId: id }).delete();
  };

  const updateHabit = async (id: string, data: any) => {
    await db.habits.update(id, data);
  };

  // --- Habit Logs ---
  const getLogs = async (startDate: string, endDate: string) => {
    return await db.habitLogs
      .where('ownerId').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
  };

  const putLog = async (log: any) => {
    await db.habitLogs.put(toPlain(log));
  };

  const deleteLog = async (id: string) => {
    await db.habitLogs.delete(id);
  };

  // --- Buckets ---
  const getBuckets = async () => {
    const buckets = await db.buckets.where('ownerId').equals(getOwnerId()).toArray();
    return buckets.sort((a, b) => {
      const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) return orderDiff;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const putBucket = async (bucket: any) => {
    await db.buckets.put(toPlain(bucket));
  };

  const deleteBucket = async (id: string) => {
    await db.buckets.delete(id);
    await db.bucketLogs.where({ bucketId: id }).delete();
  };

  const updateBucket = async (id: string, data: any) => {
    await db.buckets.update(id, data);
  };

  const getBucketLogs = async (startDate: string, endDate: string) => {
    return await db.bucketLogs
      .where('ownerId').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
  };

  const putBucketLog = async (log: any) => {
    await db.bucketLogs.put(toPlain(log));
  };

  const _internalSyncBucketLog = async (bucket: any, date: string) => {
    // DEV-1: Filter habits by approvalStatus === 'accepted'
    // Personal buckets (no sharedHabits) use habitIds as fallback.
    const acceptedHabitIds = (bucket.sharedHabits || [])
      .filter((sh: any) => sh.approvalStatus === 'accepted')
      .map((sh: any) => sh.habitId);
    
    const habitsInBucket = acceptedHabitIds.length > 0 ? acceptedHabitIds : (bucket.habitIds || []);
    
    // If no habits in bucket, we shouldn't have logs for it.
    if (habitsInBucket.length === 0) {
      await db.bucketLogs.delete(`${bucket.id}_${date}`);
      return false;
    }

    const logs = await db.habitLogs
      .where('ownerId').equals(getOwnerId())
      .filter(l => habitsInBucket.includes(l.habitId) && l.date === date && l.status !== 'cleared')
      .toArray();

    // Exact Logic: If there is no activity across ANY remaining habit, the bucket log must be destroyed.
    if (logs.length === 0) {
      await db.bucketLogs.delete(`${bucket.id}_${date}`);
      return true; // True because we might still need to recalculate streak if a log existed
    }

    const uniqueLoggedHabits = new Set(logs.map(l => l.habitId));
    const statuses = logs.map(l => l.status);
    const isMissing = uniqueLoggedHabits.size < habitsInBucket.length;

    let finalStatus: 'completed' | 'failed' | 'skipped' | 'vacation' | 'cleared' = 'completed';

    if (statuses.includes('failed')) finalStatus = 'failed';
    else if (isMissing) finalStatus = 'cleared';
    else if (statuses.includes('vacation')) finalStatus = 'vacation';
    else if (statuses.includes('skipped')) finalStatus = 'skipped';

    await db.bucketLogs.put({
      id: `${bucket.id}_${date}`,
      bucketId: bucket.id,
      ownerId: getOwnerId(),
      date: date,
      status: finalStatus,
      synced: 0,
      updatedAt: Date.now()
    } as any);
    return true;
  };

  // --- Domain Helpers ---
  const removeHabitFromBuckets = async (habitId: string) => {
    const buckets = await db.buckets.where('ownerId').equals(getOwnerId()).toArray();
    for (const bucket of buckets) {
      const isMember = bucket.habitIds?.includes(habitId) || 
                       bucket.sharedHabits?.some(sh => sh.habitId === habitId);

      if (isMember) {
        const filteredHabitIds = (bucket.habitIds || []).filter(id => id !== habitId);
        const filteredSharedHabits = (bucket.sharedHabits || []).filter(sh => sh.habitId !== habitId);
        
        await db.buckets.update(bucket.id, {
          habitIds: filteredHabitIds,
          sharedHabits: filteredSharedHabits,
          synced: (bucket as any).synced === 1 ? -1 : (bucket as any).synced,
          updatedAt: Date.now()
        });

        const updatedBucket = await db.buckets.get(bucket.id);
        if (!updatedBucket) continue;

        const habitsInBucket = (updatedBucket.sharedHabits || []).length > 0 
          ? updatedBucket.sharedHabits?.filter(sh => sh.approvalStatus === 'accepted').map(sh => sh.habitId)
          : updatedBucket.habitIds;

        if (!habitsInBucket || habitsInBucket.length === 0) {
          // Cleanup empty bucket
          await db.bucketLogs.where({ bucketId: bucket.id }).delete();
          await db.buckets.update(bucket.id, {
            currentStreak: 0,
            longestStreak: 0,
            streakAnchorDate: null,
            updatedAt: Date.now()
          });
          continue;
        }

        // Identify all affected dates: Union of existing bucket logs and remaining habit logs
        const existingBucketLogs = await db.bucketLogs.where({ bucketId: bucket.id }).toArray();
        const remainingHabitLogs = await db.habitLogs
          .where('ownerId').equals(getOwnerId())
          .filter(l => habitsInBucket.includes(l.habitId))
          .toArray();

        const allDates = new Set([
          ...existingBucketLogs.map(l => l.date),
          ...remainingHabitLogs.map(l => l.date)
        ]);

        if (allDates.size > 0) {
          const sortedDates = Array.from(allDates).sort();
          for (const date of sortedDates) {
            await _internalSyncBucketLog(updatedBucket, date);
          }
          await recalculateLocalBucketStreak(bucket.id, getOwnerId(), sortedDates[0]);
        }
      }
    }
  };

  const syncLocalBucketLogs = async (habitId: string, date: string) => {
    const allBuckets = await db.buckets.where('ownerId').equals(getOwnerId()).toArray();
    const affectedBuckets = allBuckets.filter(b => {
      const habitsInBucket = (b.sharedHabits || []).length > 0 
        ? b.sharedHabits?.filter(sh => sh.approvalStatus === 'accepted').map(sh => sh.habitId)
        : b.habitIds;
      return habitsInBucket?.includes(habitId);
    });

    for (const bucket of affectedBuckets) {
      const changed = await _internalSyncBucketLog(bucket, date);
      if (changed) {
        await recalculateLocalBucketStreak(bucket.id, getOwnerId(), date);
      }
    }
  };

  return {
    getHabits, putHabit, deleteHabit, updateHabit, getLogs, putLog, deleteLog,
    getBuckets, putBucket, deleteBucket, updateBucket, getBucketLogs, putBucketLog,
    removeHabitFromBuckets, syncLocalBucketLogs,
    generateId, toPlain, getOwnerId
  };
};
