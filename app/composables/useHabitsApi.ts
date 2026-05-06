import { db } from '~/utils/db';
import { format, subDays, addDays } from 'date-fns';
import { recalculateLocalHabitStreak, recalculateLocalBucketStreak } from '~/utils/streaks';

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
  ownerId: string;
  title: string;
  description: string;
  skipsCount: number;
  skipsPeriod: 'none' | 'weekly' | 'monthly';
  color: string;
  sharedWith: string[];
  sortOrder?: number;
  createdAt?: string;
  currentStreak?: number;
  longestStreak?: number;
  streakAnchorDate?: string | null;
  userDate?: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  ownerId: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed' | 'vacation' | 'cleared';
  sharedWith: string[];
  streakCount?: number;
  brokenStreakCount?: number;
}

export interface Bucket {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  color: string;
  habitIds: string[];
  sortOrder?: number;
  createdAt?: string;
  currentStreak?: number;
  longestStreak?: number;
  streakAnchorDate?: string | null;
  // Shared metadata
  sharedMembers?: Array<{ userId: string; username: string; status: string }>;
  sharedHabits?: Array<{ habitId: string; approvalStatus: string; addedBy: string; habitOwnerId: string }>;
}

export interface BucketLog {
  id: string;
  bucketId: string;
  ownerId: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed' | 'vacation' | 'cleared';
  streakCount?: number;
  brokenStreakCount?: number;
}

// Global module-level state to act as a true singleton lock across all components
const isSyncing = ref(false);
const syncNeeded = ref(false);

export const useHabitsApi = () => {
  const { user } = useAuth();
  const getOwnerId = () => user.value?.id || '';
  const lastSyncTime = useState('last-sync-time', () => 0);

  // Helper to strip Vue reactivity before saving to IndexedDB
  const toPlain = (obj: any) => JSON.parse(JSON.stringify(obj));

  // --- Background Sync Helpers ---
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

  const triggerSync = () => {
    sync().catch(err => console.error('[Sync] Background sync failed:', err));
  };

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

  const createHabit = async (data: Partial<Habit>) => {
    const newHabit: any = toPlain({
      ...data,
      id: data.id || generateId(),
      ownerId: getOwnerId(),
      synced: 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt || new Date().toISOString(),
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
    const habit = await db.habits.get(id);
    if (habit?.synced) {
      await db.syncQueue.add({ type: 'habit', action: 'DELETE', payload: { id } });
    }

    await db.habits.delete(id);
    await db.habitLogs.where({ habitId: id }).delete();
    await removeHabitFromBuckets(id);
    triggerSync();
  };

  const reorderHabits = async (ids: string[]) => {
    // 1. Local Settlement: Update Dexie sortOrder immediately
    const updates = ids.map(async (id, index) => {
      return db.habits.update(id, {
        sortOrder: index,
        updatedAt: Date.now()
      });
    });
    await Promise.all(updates);

    // 2. Queue Root Action: Add reorder to syncQueue
    await db.syncQueue.add({
      type: 'habit',
      action: 'REORDER',
      payload: { ids }
    });

    triggerSync();
  };

  // --- Habit Logs ---
  const getLogs = async (startDate: string, endDate: string) => {
    return await db.habitLogs
      .where('ownerId').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
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
      if (uniqueLoggedHabits.size === habitsInBucket.length) {
        let finalStatus: 'completed' | 'failed' | 'skipped' | 'vacation' = 'completed';
        const statuses = logs.map(l => l.status);

        if (statuses.includes('failed')) finalStatus = 'failed';
        else if (statuses.includes('skipped')) finalStatus = 'skipped';
        else if (statuses.includes('vacation')) finalStatus = 'vacation';

        await db.bucketLogs.put({
          id: `${bucket.id}_${date}`,
          bucketId: bucket.id,
          ownerId: getOwnerId(),
          date: date,
          status: finalStatus,
          synced: 0,
          updatedAt: Date.now()
        });
      } else {
        await db.bucketLogs.put({
          id: `${bucket.id}_${date}`,
          bucketId: bucket.id,
          ownerId: getOwnerId(),
          date: date,
          status: 'cleared',
          synced: 0,
          updatedAt: Date.now()
        });
      }
      await recalculateLocalBucketStreak(bucket.id, getOwnerId(), date);
    }
  };

  const upsertLog = async (data: { habitId: string; date: string; status: string; sharedWith?: string[] }) => {
    const logId = `${data.habitId}_${data.date}`;
    const newLog: any = toPlain({
      id: logId,
      ...data,
      ownerId: getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    });
    await db.habitLogs.put(newLog);

    await recalculateLocalHabitStreak(data.habitId, getOwnerId(), data.date);
    const habit = await db.habits.get(data.habitId);
    await syncLocalBucketLogs(data.habitId, data.date);

    triggerSync();
    return { log: newLog, habit: habit! };
  };

  const deleteLog = async (habitId: string, date: string) => {
    const result = await upsertLog({
      habitId: habitId,
      date,
      status: 'cleared'
    });
    return { success: true, ...result };
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

  const createBucket = async (data: Partial<Bucket>) => {
    const newBucket: any = toPlain({
      ...data,
      id: data.id || generateId(),
      ownerId: getOwnerId(),
      synced: 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt || new Date().toISOString(),
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
    await db.bucketLogs.where({ bucketId: id }).delete();
    triggerSync();
  };

  const getBucketLogs = async (startDate: string, endDate: string) => {
    return await db.bucketLogs
      .where('ownerId').equals(getOwnerId())
      .filter(log => log.date >= startDate && log.date <= endDate)
      .toArray();
  };

  const reorderBuckets = async (ids: string[]) => {
    // 1. Local Settlement: Update Dexie sortOrder immediately
    const updates = ids.map(async (id, index) => {
      return db.buckets.update(id, {
        sortOrder: index,
        updatedAt: Date.now()
      });
    });
    await Promise.all(updates);

    // 2. Queue Root Action: Add reorder to syncQueue
    await db.syncQueue.add({
      type: 'bucket',
      action: 'REORDER',
      payload: { ids }
    });

    triggerSync();
  };

  // --- The Core Sync Engine ---
  const sync = async () => {
    if (!user.value) return;
    if (isSyncing.value) {
      syncNeeded.value = true;
      return;
    }
    isSyncing.value = true;

    try {
      do {
        syncNeeded.value = false;

        // 0. Process Action Queue (Deletions & Reorders)
        const queuedActions = await db.syncQueue.toArray();
        for (const d of queuedActions) {
          try {
            if (d.action === 'DELETE') {
              if (d.type === 'habit') {
                await $fetch(`/api/habits/${d.payload.id}`, { method: 'DELETE' });
              } else if (d.type === 'bucket') {
                await $fetch(`/api/buckets/${d.payload.id}`, { method: 'DELETE' });
              }
            } else if (d.action === 'REORDER') {
              if (d.type === 'habit') {
                await $fetch('/api/habits/reorder', { method: 'POST', body: { ids: d.payload.ids } });
                // Mark these habits as synced
                await db.habits.where('id').anyOf(d.payload.ids).modify({ synced: 1 });
              } else if (d.type === 'bucket') {
                await $fetch('/api/buckets/reorder', { method: 'POST', body: { ids: d.payload.ids } });
                // Mark these buckets as synced
                await db.buckets.where('id').anyOf(d.payload.ids).modify({ synced: 1 });
              }
            }
            if (d.id) await db.syncQueue.delete(d.id);
          } catch (e: any) {
            if (e.statusCode === 404 && d.id) {
              await db.syncQueue.delete(d.id);
            }
            console.warn('[Sync] Action failed:', e);
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
                  await db.habits.delete(h.id);
                  await db.habitLogs.where({ habitId: h.id }).delete();
                  await removeHabitFromBuckets(h.id);
                  continue;
                }
                throw err;
              }
            }
            await db.habits.update(h.id, { synced: 1, id: remote.id, userDate: remote.userDate });
          } catch (e) {
            console.warn('[Sync] Habit push failed:', e);
          }
        }

        const unsyncedLogs = await db.habitLogs.where('synced').equals(0).toArray();
        for (const l of unsyncedLogs) {
          const stillExists = await db.habitLogs.get(l.id);
          if (!stillExists) continue;

          try {
            const response = await $fetch<{ log: HabitLog, habit: Habit }>('/api/habitlogs', {
              method: 'POST',
              body: l
            });
            const { habit } = response;
            await db.habitLogs.update(l.id, { synced: 1 });
            if (habit) {
              await db.habits.update(habit.id, { synced: 1 });
            }
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status === 400 || status === 404) {
              await db.habitLogs.delete(l.id);
            } else {
              console.warn('[Sync] Log push failed:', e);
            }
          }
        }

        const unsyncedBuckets = await db.buckets.where('synced').notEqual(1).toArray();
        const allLocalHabitIds = new Set((await db.habits.toArray()).map(h => h.id));

        for (const b of unsyncedBuckets) {
          const stillExists = await db.buckets.get(b.id);
          if (!stillExists) continue;

          const originalHabitIds = b.habitIds || [];
          const validHabitIds = originalHabitIds.filter(id => allLocalHabitIds.has(id));
          if (validHabitIds.length !== originalHabitIds.length) {
            b.habitIds = validHabitIds;
            await db.buckets.update(b.id, { habitIds: validHabitIds });
          }

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
            await db.buckets.update(b.id, { synced: 1, id: remote.id });
          } catch (e) {
            console.warn('[Sync] Bucket push failed:', e);
          }
        }

        const unsyncedBucketLogs = await db.bucketLogs.where('synced').equals(0).toArray();
        for (const bl of unsyncedBucketLogs) {
          try {
            await $fetch('/api/bucketlogs', {
              method: 'POST',
              body: bl
            });
            await db.bucketLogs.update(bl.id, { synced: 1 });
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status === 400 || status === 404 || status === 405) {
              await db.bucketLogs.delete(bl.id);
            } else {
              console.warn('[Sync] BucketLog push failed:', e);
            }
          }
        }

        // 2. Pull remote changes using Authoritative Server Time
        try {
          const queryParams: any = {};
          if (lastSyncTime.value > 0) {
            queryParams.lastSynced = lastSyncTime.value;
          } else {
            queryParams.startDate = format(subDays(new Date(), 60), 'yyyy-MM-dd');
            queryParams.endDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
          }

          const response = await $fetch<{
            habits: Habit[], 
            buckets: Bucket[], 
            habitLogs: HabitLog[], 
            bucketLogs: BucketLog[],
            deletions?: { id: string, type: string }[],
            serverTime: number
          }>('/api/sync', { query: queryParams });

          const { habits: remoteHabits, buckets: remoteBuckets, habitLogs: remoteLogs, bucketLogs: remoteBucketLogs, deletions: remoteDeletions, serverTime } = response;

          // 3. Handle Deletions from Server
          if (remoteDeletions && remoteDeletions.length > 0) {
            for (const d of remoteDeletions) {
              if (d.type === 'habit') {
                await db.habits.delete(d.id);
                await db.habitLogs.where({ habitId: d.id }).delete();
                await removeHabitFromBuckets(d.id);
              } else if (d.type === 'bucket') {
                await db.buckets.delete(d.id);
                await db.bucketLogs.where({ bucketId: d.id }).delete();
              }
            }
          }

          // 3. Cleanup: Unconditionally purge any legacy UUID logs from local database
          const allLocalLogs = await db.habitLogs.toArray();
          const legacyLogIds = allLocalLogs.filter(l => !l.id.includes('_')).map(l => l.id);
          if (legacyLogIds.length > 0) {
            console.log(`[Sync] Purging ${legacyLogIds.length} legacy habit logs...`);
            await db.habitLogs.bulkDelete(legacyLogIds);
          }

          const allLocalBucketLogs = await db.bucketLogs.toArray();
          const legacyBucketLogIds = allLocalBucketLogs.filter(l => !l.id.includes('_')).map(l => l.id);
          if (legacyBucketLogIds.length > 0) {
            console.log(`[Sync] Purging ${legacyBucketLogIds.length} legacy bucket logs...`);
            await db.bucketLogs.bulkDelete(legacyBucketLogIds);
          }

          // Merge Habits
          for (const h of remoteHabits) {
            const local = await db.habits.get(h.id);
            if (local && local.synced === 0) continue;
            await db.habits.put({ ...h, synced: 1, updatedAt: Date.now() });
          }

          // Merge Buckets
          for (const b of remoteBuckets) {
            const local = await db.buckets.get(b.id);
            if (local && local.synced === 0) continue;
            await db.buckets.put({ ...b, synced: 1, updatedAt: Date.now() });
          }

          // Merge Habit Logs
          for (const l of remoteLogs) {
            const local = await db.habitLogs.get(l.id);
            if (local && local.synced === 0) continue;
            await db.habitLogs.put({ ...l, synced: 1, updatedAt: Date.now() });
          }

          // Merge Bucket Logs
          for (const bl of remoteBucketLogs) {
            const local = await db.bucketLogs.get(bl.id);
            if (local && local.synced === 0) continue;
            await db.bucketLogs.put({ ...bl, synced: 1, updatedAt: Date.now() });
          }

          lastSyncTime.value = serverTime;
        } catch (error) {
          console.error('[Sync] Pull failed:', error);
          if (error instanceof Error && error.message.includes('401')) {
            return;
          }
        }
      } while (syncNeeded.value);
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, reorderHabits,
    getBuckets, createBucket, updateBucket, deleteBucket, getBucketLogs, reorderBuckets,
    sync,
    lastSyncTime
  };
};
