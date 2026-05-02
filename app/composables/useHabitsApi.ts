import { db } from '~/utils/db';
import { format, subDays, addDays } from 'date-fns';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts or older browsers: valid UUIDv4 structure
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
  status: 'completed' | 'skipped' | 'failed' | 'cleared';
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
  status: 'completed' | 'skipped' | 'failed' | 'cleared';
}

export const useHabitsApi = () => {
  const { user } = useAuth();
  const getOwnerId = () => user.value?.id || '';
  const lastSyncTime = useState('last-sync-time', () => 0);
  const isSyncing = ref(false);
  let syncNeeded = false;

  // Helper to strip Vue reactivity before saving to IndexedDB
  const toPlain = (obj: any) => JSON.parse(JSON.stringify(obj));

  // Helper to ensure dates from the server are always clean YYYY-MM-DD strings
  const normalizeData = (obj: any) => {
    if (!obj) return obj;
    const res = { ...obj };
    // Handle habit/bucket log date
    if (res.date) {
      res.date = format(new Date(res.date), 'yyyy-MM-dd');
    }
    // Handle streak anchor dates
    if (res.streakAnchorDate) {
      res.streakAnchorDate = format(new Date(res.streakAnchorDate), 'yyyy-MM-dd');
    }
    return res;
  };

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
    const newHabit: any = toPlain({
      ...data,
      id: data.id || generateId(),
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    });
    await db.habits.put(newHabit);
    triggerSync();
    return newHabit;
  };

  const updateHabit = async (id: string, data: Partial<Habit>) => {
    const existing = await db.habits.get(id);
    if (!existing) throw new Error('Habit not found');

    const updated = toPlain({
      ...existing,
      ...data,
      synced: (existing as any).synced === 1 ? -1 : (existing as any).synced,
      updatedAt: Date.now()
    });
    await db.habits.put(updated);
    triggerSync();
    return updated;
  };

  const deleteHabit = async (id: string) => {
    // Check if it was synced. If yes, we need to tell the server.
    const habit = await db.habits.get(id);
    if (habit?.synced) {
      await db.syncQueue.add({ type: 'habit', action: 'DELETE', payload: { id } });
    }

    await db.habits.delete(id);
    // Also delete related logs locally
    await db.habitLogs.where({ habitid: id }).delete();
    triggerSync();
  };

  const reorderHabits = async (ids: string[]) => {
    // Update local sort orders
    const updates = ids.map(async (id, index) => {
      const existing = await db.habits.get(id);
      return db.habits.update(id, {
        sortOrder: index,
        synced: (existing as any)?.synced === 1 ? -1 : (existing as any)?.synced,
        updatedAt: Date.now()
      });
    });
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

  const syncLocalBucketLogs = async (habitId: string, date: string) => {
    // 1. Find all buckets containing this habit
    const allBuckets = await db.buckets.where('ownerid').equals(getOwnerId()).toArray();
    const affectedBuckets = allBuckets.filter(b => b.habitIds?.includes(habitId));

    for (const bucket of affectedBuckets) {
      // 2. Get all habits in this bucket
      const habitsInBucket = bucket.habitIds || [];
      if (habitsInBucket.length === 0) continue;

      // 3. Check local habit logs for this date
      const logs = await db.habitLogs
        .where('ownerid').equals(getOwnerId())
        .filter(l => habitsInBucket.includes(l.habitid) && l.date === date && l.status !== 'cleared')
        .toArray();

      if (logs.length === habitsInBucket.length) {
        // All habits logged! Calculate status.
        let finalStatus: 'completed' | 'failed' | 'skipped' = 'completed';
        const statuses = logs.map(l => l.status);

        if (statuses.includes('failed')) finalStatus = 'failed';
        else if (statuses.includes('skipped')) finalStatus = 'skipped';

        await db.bucketLogs.put({
          id: `${bucket.id}_${date}`,
          bucketid: bucket.id,
          ownerid: getOwnerId(),
          date: date,
          status: finalStatus,
          synced: 0,
          updatedAt: Date.now()
        });
      } else {
        // Not all habits logged, mark the bucket log as cleared
        await db.bucketLogs.put({
          id: `${bucket.id}_${date}`,
          bucketid: bucket.id,
          ownerid: getOwnerId(),
          date: date,
          status: 'cleared',
          synced: 0,
          updatedAt: Date.now()
        });
      }
    }
  };

  const upsertLog = async (data: { habitid: string; date: string; status: string; sharedwith?: string[] }) => {
    const logId = `${data.habitid}_${data.date}`;
    const newLog: any = toPlain({
      id: logId,
      ...data,
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    });
    await db.habitLogs.put(newLog);

    // We return the habit too because UI expects recalculated streaks
    // In a full offline mode, we'd calculate this locally. 
    // For now, we return the existing habit and let the sync update it.
    const habit = await db.habits.get(data.habitid);

    // Optimistically update affected buckets locally
    await syncLocalBucketLogs(data.habitid, data.date);

    triggerSync();
    return { log: newLog, habit: habit! };
  };

  const deleteLog = async (habitId: string, date: string) => {
    // Instead of deleting, we upsert with a 'cleared' status
    // This avoids race conditions by making 'Clear' an explicit state that syncs like any other status
    const result = await upsertLog({
      habitid: habitId,
      date,
      status: 'cleared'
    });
    return { success: true, ...result };
  };

  // --- Buckets ---
  const getBuckets = async () => {
    const buckets = await db.buckets.where('ownerid').equals(getOwnerId()).toArray();
    return buckets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  const createBucket = async (data: Partial<Bucket>) => {
    const newBucket: any = toPlain({
      ...data,
      id: data.id || generateId(),
      ownerid: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    });
    await db.buckets.put(newBucket);
    triggerSync();
    return newBucket;
  };

  const updateBucket = async (id: string, data: Partial<Bucket>) => {
    const existing = await db.buckets.get(id);
    if (!existing) throw new Error('Bucket not found');

    const updated = toPlain({
      ...existing,
      ...data,
      synced: (existing as any).synced === 1 ? -1 : (existing as any).synced,
      updatedAt: Date.now()
    });
    await db.buckets.put(updated);
    triggerSync();
    return updated;
  };

  const deleteBucket = async (id: string) => {
    const bucket = await db.buckets.get(id);
    if (bucket?.synced) {
      await db.syncQueue.add({ type: 'bucket', action: 'DELETE', payload: { id } });
    }
    await db.buckets.delete(id);
    triggerSync();
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
    if (isSyncing.value) {
      syncNeeded = true;
      return;
    }
    isSyncing.value = true;

    try {
      do {
        syncNeeded = false;

        // 0. Process Deletion Queue
        const deletions = await db.syncQueue.toArray();
        for (const d of deletions) {
          try {
            if (d.type === 'habit') {
              await $fetch(`/api/habits/${d.payload.id}`, { method: 'DELETE' });
            } else if (d.type === 'bucket') {
              await $fetch(`/api/buckets/${d.payload.id}`, { method: 'DELETE' });
            }
            if (d.id) await db.syncQueue.delete(d.id);
          } catch (e: any) {
            // If 404, it's already gone from server, so we can remove from queue
            if (e.statusCode === 404 && d.id) {
              await db.syncQueue.delete(d.id);
            }
            console.warn('[Sync] Deletion failed:', e);
          }
        }

        // 1. Push local changes to server
        const unsyncedHabits = await db.habits.where('synced').notEqual(1).toArray();
        for (const h of unsyncedHabits) {
          const stillExists = await db.habits.get(h.id);
          if (!stillExists) continue;

          try {
            let remote;
            const isNew = (h as any).synced === 0;

            if (isNew) {
              remote = await $fetch<Habit>('/api/habits', { method: 'POST', body: h });
            } else {
              try {
                remote = await $fetch<Habit>(`/api/habits/${h.id}`, { method: 'PUT', body: h });
              } catch (err: any) {
                if (err.statusCode === 404) {
                  // If it was supposed to exist but is gone from server, it was deleted remotely.
                  // Sync that deletion locally.
                  await db.habits.delete(h.id);
                  await db.habitLogs.where({ habitid: h.id }).delete();
                  continue;
                }
                throw err;
              }
            }
            await db.habits.update(h.id, { ...normalizeData(remote), synced: 1 });
          } catch (e) {
            console.warn('[Sync] Habit push failed:', e);
          }
        }

        const unsyncedLogs = await db.habitLogs.where('synced').equals(0).toArray();
        for (const l of unsyncedLogs) {
          const stillExists = await db.habitLogs.get(l.id);
          if (!stillExists) continue;

          try {
            const { log, habit } = await $fetch<{ log: HabitLog, habit: Habit }>('/api/habitlogs', {
              method: 'POST',
              body: l
            });

            const normalizedLog = normalizeData(log);
            const normalizedHabit = normalizeData(habit);

            // Use our local composite ID (habitid_date) instead of the server's UUID
            if (normalizedLog) delete (normalizedLog as any).id;

            await db.habitLogs.update(l.id, { ...normalizedLog, synced: 1 });
            if (normalizedHabit) {
              await db.habits.update(normalizedHabit.id, { ...normalizedHabit, synced: 1 });
            }
          } catch (e) {
            console.warn('[Sync] Log push failed:', e);
          }
        }

        const unsyncedBuckets = await db.buckets.where('synced').notEqual(1).toArray();
        for (const b of unsyncedBuckets) {
          const stillExists = await db.buckets.get(b.id);
          if (!stillExists) continue;

          try {
            let remote;
            const isNew = (b as any).synced === 0;

            if (isNew) {
              remote = await $fetch<Bucket>('/api/buckets', { method: 'POST', body: b });
            } else {
              try {
                remote = await $fetch<Bucket>(`/api/buckets/${b.id}`, { method: 'PUT', body: b });
              } catch (err: any) {
                if (err.statusCode === 404) {
                  await db.buckets.delete(b.id);
                  continue;
                }
                throw err;
              }
            }
            await db.buckets.update(b.id, { ...normalizeData(remote), synced: 1 });
          } catch (e) {
            console.warn('[Sync] Bucket push failed:', e);
          }
        }

        // 2. Pull remote changes
        try {
          const start = format(subDays(new Date(), 60), 'yyyy-MM-dd');
          const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');

          const [remoteHabits, remoteBuckets, remoteLogs, remoteBucketLogs] = await Promise.all([
            $fetch<Habit[]>('/api/habits'),
            $fetch<Bucket[]>('/api/buckets'),
            $fetch<HabitLog[]>('/api/habitlogs', { query: { startDate: start, endDate: end } }),
            $fetch<BucketLog[]>('/api/bucketlogs', { query: { startDate: start, endDate: end } })
          ]);

          // Bulk update local DB with remote truth
          await db.transaction('rw', db.habits, db.buckets, db.habitLogs, db.bucketLogs, async () => {
            for (const h of remoteHabits) {
              const normalized = normalizeData(h);
              const local = await db.habits.get(normalized.id);
              // CRITICAL: Don't overwrite local changes that haven't synced yet
              if (local && local.synced === 0) continue;
              await db.habits.put({ ...normalized, synced: 1, updatedAt: Date.now() });
            }
            for (const l of remoteLogs) {
              const normalized = normalizeData(l);
              const logId = `${normalized.habitid}_${normalized.date}`;
              const local = await db.habitLogs.get(logId);
              if (local && local.synced === 0) continue;
              await db.habitLogs.put({ ...normalized, id: logId, synced: 1, updatedAt: Date.now() });
            }
            for (const b of remoteBuckets) {
              const normalized = normalizeData(b);
              const local = await db.buckets.get(normalized.id);
              if (local && local.synced === 0) continue;
              await db.buckets.put({ ...normalized, synced: 1, updatedAt: Date.now() });
            }
            for (const bl of remoteBucketLogs) {
              const normalized = normalizeData(bl);
              const local = await db.bucketLogs.get(normalized.id);
              if (local && local.synced === 0) continue;
              await db.bucketLogs.put({ ...normalized, synced: 1, updatedAt: Date.now() });
            }
          });
          lastSyncTime.value = Date.now();
        } catch (e) {
          console.warn('[Sync] Pull failed (offline?)', e);
        }
      } while (syncNeeded);
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, reorderHabits,
    getBuckets, createBucket, updateBucket, deleteBucket, getBucketLogs,
    sync,
    lastSyncTime
  };
};


