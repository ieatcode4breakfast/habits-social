import { db } from '~/utils/db';
import { format, subDays, addDays } from 'date-fns';

export interface Habit {
  id: string;
  ownerid: string;
  title: string;
  description: string;
  frequencyCount: number;
  frequencyPeriod: 'daily' | 'weekly' | 'monthly';
  color: string;
  sharedwith: string[];
  sortOrder?: number;
  currentStreak?: number;
  longestStreak?: number;
  streakAnchorDate?: string | null;
  user_date?: string;
}

export interface HabitLog {
  id: string;
  habitid: string;
  ownerid: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
  sharedwith: string[];
}

export interface Bucket {
  id: string;
  ownerid: string;
  title: string;
  description: string;
  color: string;
  habitIds: string[];
  sortOrder?: number;
  currentStreak?: number;
  longestStreak?: number;
  streakAnchorDate?: string | null;
}

export interface BucketLog {
  id: string;
  bucketid: string;
  ownerid: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
}

export const useHabitsApi = () => {
  const { user } = useAuth();
  const getOwnerId = () => user.value?.id || '';

  // --- Background Sync Helpers ---
  const triggerSync = () => {
    // We'll implement the full sync logic in a moment, 
    // for now we just fire and forget the sync process
    sync().catch(err => console.error('[Sync] Background sync failed:', err));
  };

  // --- Habits ---
  const getHabits = async () => {
    const habits = await db.habits.where('ownerid').equals(getOwnerId()).toArray();
    return habits.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  const createHabit = async (data: Partial<Habit>) => {
    const newHabit: any = {
      ...data,
      id: data.id || crypto.randomUUID(),
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    };
    await db.habits.put(newHabit);
    triggerSync();
    return newHabit;
  };

  const updateHabit = async (id: string, data: Partial<Habit>) => {
    const existing = await db.habits.get(id);
    if (!existing) throw new Error('Habit not found');
    
    const updated = {
      ...existing,
      ...data,
      synced: 0,
      updatedAt: Date.now()
    };
    await db.habits.put(updated);
    triggerSync();
    return updated;
  };

  const deleteHabit = async (id: string) => {
    await db.habits.delete(id);
    // For deletions, we might need a "tombstone" or just call the API directly
    await $fetch(`/api/habits/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const reorderHabits = async (ids: string[]) => {
    // Update local sort orders
    const updates = ids.map((id, index) => 
      db.habits.update(id, { sortOrder: index, synced: 0, updatedAt: Date.now() })
    );
    await Promise.all(updates);
    triggerSync();
  };

  // --- Habit Logs ---
  const getLogs = async (startDate: string, endDate: string) => {
    return await db.habitLogs
      .where('ownerid').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
  };

  const upsertLog = async (data: { habitid: string; date: string; status: string; sharedwith?: string[] }) => {
    const logId = `${data.habitid}_${data.date}`;
    const newLog: any = {
      id: logId,
      ...data,
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    };
    await db.habitLogs.put(newLog);
    
    // We return the habit too because UI expects recalculated streaks
    // In a full offline mode, we'd calculate this locally. 
    // For now, we return the existing habit and let the sync update it.
    const habit = await db.habits.get(data.habitid);
    triggerSync();
    return { log: newLog, habit: habit! };
  };

  const deleteLog = async (habitid: string, date: string) => {
    const logId = `${habitid}_${date}`;
    await db.habitLogs.delete(logId);
    const habit = await db.habits.get(habitid);
    triggerSync();
    return { success: true, habit: habit! };
  };

  // --- Buckets ---
  const getBuckets = async () => {
    const buckets = await db.buckets.where('ownerid').equals(getOwnerId()).toArray();
    return buckets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  const createBucket = async (data: Partial<Bucket>) => {
    const newBucket: any = {
      ...data,
      id: data.id || crypto.randomUUID(),
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    };
    await db.buckets.put(newBucket);
    triggerSync();
    return newBucket;
  };

  const updateBucket = async (id: string, data: Partial<Bucket>) => {
    const existing = await db.buckets.get(id);
    if (!existing) throw new Error('Bucket not found');
    
    const updated = {
      ...existing,
      ...data,
      synced: 0,
      updatedAt: Date.now()
    };
    await db.buckets.put(updated);
    triggerSync();
    return updated;
  };

  const deleteBucket = async (id: string) => {
    await db.buckets.delete(id);
    await $fetch(`/api/buckets/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const getBucketLogs = async (startDate: string, endDate: string) => {
    return await db.bucketLogs
      .where('ownerid').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
  };

  // --- The Core Sync Engine ---
  const sync = async () => {
    if (!user.value) return;

    // 1. Push local changes to server
    const unsyncedHabits = await db.habits.where('synced').equals(0).toArray();
    for (const h of unsyncedHabits) {
      try {
        const remote = await $fetch<Habit>(`/api/habits/${h.id}`, { 
          method: 'PUT', 
          body: h 
        }).catch(() => $fetch<Habit>('/api/habits', { method: 'POST', body: h }));
        
        await db.habits.update(h.id, { ...remote, synced: 1 });
      } catch (e) {}
    }

    const unsyncedLogs = await db.habitLogs.where('synced').equals(0).toArray();
    for (const l of unsyncedLogs) {
      try {
        const { log, habit } = await $fetch<{ log: HabitLog, habit: Habit }>('/api/habitlogs', { 
          method: 'POST', 
          body: l 
        });
        await db.habitLogs.update(l.id, { ...log, synced: 1 });
        await db.habits.update(habit.id, { ...habit, synced: 1 });
      } catch (e) {}
    }

    // 2. Pull remote changes
    try {
      const start = format(subDays(new Date(), 60), 'yyyy-MM-dd');
      const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');

      const [remoteHabits, remoteBuckets, remoteLogs] = await Promise.all([
        $fetch<Habit[]>('/api/habits'),
        $fetch<Bucket[]>('/api/buckets'),
        $fetch<HabitLog[]>('/api/habitlogs', { query: { startDate: start, endDate: end } })
      ]);

      // Bulk update local DB with remote truth
      await db.transaction('rw', db.habits, db.buckets, db.habitLogs, async () => {
        for (const h of remoteHabits) {
          await db.habits.put({ ...h, synced: 1, updatedAt: Date.now() });
        }
        for (const b of remoteBuckets) {
          await db.buckets.put({ ...b, synced: 1, updatedAt: Date.now() });
        }
        for (const l of remoteLogs) {
          // Use a composite ID for logs to avoid duplicates
          const logId = `${l.habitid}_${l.date}`;
          await db.habitLogs.put({ ...l, id: logId, synced: 1, updatedAt: Date.now() });
        }
      });
    } catch (e) {
      console.warn('[Sync] Pull failed (offline?)', e);
    }
  };

  return { 
    getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, reorderHabits,
    getBuckets, createBucket, updateBucket, deleteBucket, getBucketLogs,
    sync
  };
};

