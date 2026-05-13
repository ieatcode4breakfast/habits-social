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

  // --- Domain Helpers ---
  const removeHabitFromBuckets = async (habitId: string) => {
    const buckets = await db.buckets.toArray();
    for (const bucket of buckets) {
      if (bucket.habitIds?.includes(habitId)) {
        const filtered = bucket.habitIds.filter(id => id !== habitId);
        await db.buckets.update(bucket.id, {
          habitIds: filtered,
          synced: (bucket as any).synced === 1 ? -1 : (bucket as any).synced,
          updatedAt: Date.now()
        });
      }
    }
  };

  const syncLocalBucketLogs = async (habitId: string, date: string) => {
    const allBuckets = await db.buckets.where('ownerId').equals(getOwnerId()).toArray();
    const affectedBuckets = allBuckets.filter(b => b.habitIds?.includes(habitId));

    for (const bucket of affectedBuckets) {
      const habitsInBucket = bucket.habitIds || [];
      if (habitsInBucket.length === 0) continue;

      const logs = await db.habitLogs
        .where('ownerId').equals(getOwnerId())
        .filter(l => habitsInBucket.includes(l.habitId) && l.date === date && l.status !== 'cleared')
        .toArray();

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
      await recalculateLocalBucketStreak(bucket.id, getOwnerId(), date);
    }
  };

  return {
    getHabits, putHabit, deleteHabit, updateHabit, getLogs, putLog, deleteLog,
    getBuckets, putBucket, deleteBucket, updateBucket, getBucketLogs, putBucketLog,
    removeHabitFromBuckets, syncLocalBucketLogs,
    generateId, toPlain, getOwnerId
  };
};
