import { format, subDays, addDays } from 'date-fns';
import { liveQuery } from 'dexie';
import { db } from '~/utils/db';
import { useHabitsClient } from './useHabitsClient';
import { useHabitsStore } from './useHabitsStore';

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

const isSyncing = ref(false);
const syncNeeded = ref(false);
const retryCount = ref(0);
const retryTimer = ref<any>(null);

// For testing only
export const _resetSyncState = () => {
  isSyncing.value = false;
  syncNeeded.value = false;
  retryCount.value = 0;
  if (retryTimer.value) {
    clearTimeout(retryTimer.value);
    retryTimer.value = null;
  }
};

export const useHabitsApi = () => {
  const client = useHabitsClient();
  const store = useHabitsStore();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  
  let lastSyncTime: Ref<number>;
  try {
    lastSyncTime = useState('last-sync-time', () => 0);
  } catch {
    lastSyncTime = ref(0);
  }

  const triggerSync = () => {
    // Reset backoff on manual/explicit actions
    retryCount.value = 0;
    if (retryTimer.value) {
      clearTimeout(retryTimer.value);
      retryTimer.value = null;
    }
    sync().catch(err => console.error('[Sync] Background sync failed:', err));
  };

  // --- Reactive State (Facade Layer) ---
  const habits = ref<Habit[]>([]);
  const buckets = ref<Bucket[]>([]);

  if (import.meta.client) {
    const habitsQuery = liveQuery(() => store.getHabits());
    const bucketsQuery = liveQuery(() => store.getBuckets());
    
    habitsQuery.subscribe(val => { habits.value = val; });
    bucketsQuery.subscribe(val => { buckets.value = val; });
  }

  // --- Habits ---
  const getHabits = () => store.getHabits();

  const createHabit = async (data: Partial<Habit>) => {
    const newHabit: any = store.toPlain({
      ...data,
      id: data.id || store.generateId(),
      ownerId: store.getOwnerId(),
      synced: 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: Date.now()
    });
    await store.putHabit(newHabit);
    triggerSync();
    return newHabit;
  };

  const updateHabit = async (id: string, data: Partial<Habit>) => {
    const existing = await db.habits.get(id);
    if (!existing) throw new Error('Habit not found');

    const updated = store.toPlain({
      ...existing,
      ...data,
      synced: (existing as any).synced === 1 ? -1 : (existing as any).synced,
      updatedAt: Date.now()
    });
    await store.putHabit(updated);
    triggerSync();
    return updated;
  };

  const deleteHabit = async (id: string) => {
    const habit = await db.habits.get(id);
    if (habit?.synced) {
      await db.syncQueue.add({ type: 'habit', action: 'DELETE', payload: { id } });
    }
    await store.deleteHabit(id);
    await store.removeHabitFromBuckets(id);
    triggerSync();
  };

  const reorderHabits = async (ids: string[]) => {
    const updates = ids.map(async (id, index) => {
      return store.updateHabit(id, {
        sortOrder: index,
        updatedAt: Date.now()
      });
    });
    await Promise.all(updates);
    await db.syncQueue.add({ type: 'habit', action: 'REORDER', payload: { ids } });
    triggerSync();
  };

  // --- Habit Logs ---
  const getLogs = (startDate: string, endDate: string) => store.getLogs(startDate, endDate);

  const upsertLog = async (data: { habitId: string; date: string; status: string; sharedWith?: string[] }) => {
    const logId = `${data.habitId}_${data.date}`;
    const newLog: any = store.toPlain({
      id: logId,
      ...data,
      ownerId: store.getOwnerId(),
      synced: 0,
      updatedAt: Date.now()
    });
    await store.putLog(newLog);

    const { recalculateLocalHabitStreak } = await import('~/utils/streaks');
    await recalculateLocalHabitStreak(data.habitId, store.getOwnerId(), data.date);
    
    const habit = await db.habits.get(data.habitId);
    await store.syncLocalBucketLogs(data.habitId, data.date);

    triggerSync();
    return { log: newLog, habit: habit! };
  };

  const deleteLog = async (habitId: string, date: string) => {
    return await upsertLog({ habitId, date, status: 'cleared' });
  };

  // --- Buckets ---
  const getBuckets = () => store.getBuckets();

  const createBucket = async (data: Partial<Bucket>) => {
    const newBucket: any = store.toPlain({
      ...data,
      id: data.id || store.generateId(),
      ownerId: store.getOwnerId(),
      synced: 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: Date.now()
    });
    await store.putBucket(newBucket);
    triggerSync();
    return newBucket;
  };

  const updateBucket = async (id: string, data: Partial<Bucket>) => {
    const existing = await db.buckets.get(id);
    if (!existing) throw new Error('Bucket not found');

    const updated = store.toPlain({
      ...existing,
      ...data,
      synced: (existing as any).synced === 1 ? -1 : (existing as any).synced,
      updatedAt: Date.now()
    });
    await store.putBucket(updated);
    triggerSync();
    return updated;
  };

  const deleteBucket = async (id: string) => {
    const bucket = await db.buckets.get(id);
    if (bucket?.synced) {
      await db.syncQueue.add({ type: 'bucket', action: 'DELETE', payload: { id } });
    }
    await store.deleteBucket(id);
    triggerSync();
  };

  const getBucketLogs = (startDate: string, endDate: string) => store.getBucketLogs(startDate, endDate);

  const reorderBuckets = async (ids: string[]) => {
    const updates = ids.map(async (id, index) => {
      return store.updateBucket(id, {
        sortOrder: index,
        updatedAt: Date.now()
      });
    });
    await Promise.all(updates);
    await db.syncQueue.add({ type: 'bucket', action: 'REORDER', payload: { ids } });
    triggerSync();
  };

  // --- The Core Sync Engine (Reconciliation) ---
  const sync = async () => {
    if (!user.value || !process.client) return;
    
    // Atomic Concurrency Lock
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
              if (d.type === 'habit') await client.deleteHabit(d.payload.id);
              else if (d.type === 'bucket') await client.deleteBucket(d.payload.id);
            } else if (d.action === 'REORDER') {
              if (d.type === 'habit') {
                await client.postReorderHabits(d.payload.ids);
                await db.habits.where('id').anyOf(d.payload.ids).modify({ synced: 1 });
              } else if (d.type === 'bucket') {
                await client.postReorderBuckets(d.payload.ids);
                await db.buckets.where('id').anyOf(d.payload.ids).modify({ synced: 1 });
              }
            }
            if (d.id) await db.syncQueue.delete(d.id);
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status === 404 && d.id) {
              await db.syncQueue.delete(d.id);
            } else if (status >= 400 && status < 500 && status !== 429) {
              // Terminal error: Drop item and notify user
              if (d.id) await db.syncQueue.delete(d.id);
              showToast("A queued action could not be saved.", "failed");
            } else {
              // Transient error: Re-throw to trigger backoff loop
              throw e;
            }
          }
        }

        // 1. Push local changes
        const unsyncedHabits = await db.habits.where('synced').notEqual(1).toArray();
        for (const h of unsyncedHabits) {
          const stillExists = await db.habits.get(h.id);
          if (!stillExists) continue;
          try {
            const isNew = (h as any).synced === 0;
            const res = isNew ? await client.postHabit(h) : await client.putHabit(h.id, h);
            await db.habits.update(h.id, { synced: 1, id: res.data.id, userDate: res.data.userDate });
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status === 404) {
              await store.deleteHabit(h.id);
              await store.removeHabitFromBuckets(h.id);
            } else if (status >= 400 && status < 500 && status !== 429) {
              await db.habits.update(h.id, { synced: 1 });
              showToast("A habit update could not be saved.", "failed");
            } else {
              throw e;
            }
          }
        }

        const unsyncedLogs = await db.habitLogs.where('synced').equals(0).toArray();
        for (const l of unsyncedLogs) {
          try {
            await client.postHabitLog(l);
            await db.habitLogs.update(l.id, { synced: 1 });
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status >= 400 && status < 500 && status !== 429) {
              await db.habitLogs.delete(l.id);
              showToast("A habit log could not be saved.", "failed");
            } else {
              throw e;
            }
          }
        }

        const unsyncedBuckets = await db.buckets.where('synced').notEqual(1).toArray();
        for (const b of unsyncedBuckets) {
          try {
            const isNew = (b as any).synced === 0;
            const res = isNew ? await client.postBucket(b) : await client.putBucket(b.id, b);
            await db.buckets.update(b.id, { synced: 1, id: res.data.id });
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status === 404) {
              await db.buckets.delete(b.id);
            } else if (status >= 400 && status < 500 && status !== 429) {
              await db.buckets.update(b.id, { synced: 1 });
              showToast("A bucket update could not be saved.", "failed");
            } else {
              throw e;
            }
          }
        }

        const unsyncedBucketLogs = await db.bucketLogs.where('synced').equals(0).toArray();
        for (const bl of unsyncedBucketLogs) {
          try {
            await client.postBucketLog(bl);
            await db.bucketLogs.update(bl.id, { synced: 1 });
          } catch (e: any) {
            const status = e.statusCode || e.response?.status;
            if (status >= 400 && status < 500 && status !== 429) {
              await db.bucketLogs.delete(bl.id);
              showToast("A bucket log could not be saved.", "failed");
            } else {
              throw e;
            }
          }
        }

        // 2. Pull remote changes
        try {
          const queryParams: any = {};
          if (lastSyncTime.value > 0) {
            queryParams.lastSynced = lastSyncTime.value;
          } else {
            queryParams.startDate = format(subDays(new Date(), 60), 'yyyy-MM-dd');
            queryParams.endDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
          }

          const response = await client.fetchSync(queryParams);
          const { habits: remoteHabits, buckets: remoteBuckets, habitLogs: remoteLogs, bucketLogs: remoteBucketLogs, deletions: remoteDeletions, serverTime } = response;

          if (remoteDeletions) {
            for (const d of remoteDeletions) {
              if (d.type === 'habit') {
                await store.deleteHabit(d.id);
                await store.removeHabitFromBuckets(d.id);
              } else if (d.type === 'bucket') {
                await store.deleteBucket(d.id);
              }
            }
          }

          for (const h of remoteHabits) {
            const local = await db.habits.get(h.id);
            if (local && (local as any).synced !== 1) continue;
            await db.habits.put({ ...h, synced: 1, updatedAt: Date.now() } as any);
          }

          for (const b of remoteBuckets) {
            const local = await db.buckets.get(b.id);
            if (local && (local as any).synced !== 1) continue;
            await db.buckets.put({ ...b, synced: 1, updatedAt: Date.now() } as any);
          }

          for (const l of remoteLogs) {
            const local = await db.habitLogs.get(l.id);
            if (local && (local as any).synced !== 1) continue;
            await db.habitLogs.put({ ...l, synced: 1, updatedAt: Date.now() } as any);
          }

          for (const bl of remoteBucketLogs) {
            const local = await db.bucketLogs.get(bl.id);
            if (local && (local as any).synced !== 1) continue;
            await db.bucketLogs.put({ ...bl, synced: 1, updatedAt: Date.now() } as any);
          }

          lastSyncTime.value = serverTime;
        } catch (error: any) {
          const status = error.statusCode || error.response?.status;
          if (status >= 400 && status < 500 && status !== 429) {
            console.error('[Sync] Pull failed (Terminal):', error);
          } else {
            throw error; // Trigger backoff
          }
        }
      } while (syncNeeded.value);

      // On success, reset backoff
      retryCount.value = 0;
    } catch (error: any) {
      console.warn('[Sync] Transient error, scheduling backoff retry...', error);
      
      // Calculate Full Jitter Backoff
      retryCount.value++;
      const baseDelay = Math.min(Math.pow(2, retryCount.value) * 1000, 300000);
      const jitterDelay = Math.random() * baseDelay;
      
      if (retryTimer.value) clearTimeout(retryTimer.value);
      retryTimer.value = setTimeout(() => {
        retryTimer.value = null;
        sync();
      }, jitterDelay);
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, reorderHabits,
    getBuckets, createBucket, updateBucket, deleteBucket, getBucketLogs, reorderBuckets,
    sync, lastSyncTime,
    habits, buckets
  };
};
