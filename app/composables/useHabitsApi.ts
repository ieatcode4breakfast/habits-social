import { format, subDays, addDays } from 'date-fns';
import { liveQuery } from 'dexie';
import { db } from '~/utils/db';
import { useHabitsClient } from './useHabitsClient';
import { useHabitsStore } from './useHabitsStore';
import type { SyncResponse } from '../../server/types/sync';

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

// Fallback state for non-Nuxt environments (e.g., unit tests)
const _testSyncState = {
  isSyncing: ref(false),
  syncNeeded: ref(false),
  skipPullAfterHabitLogPush: ref(false),
  retryCount: ref(0),
  retryTimer: ref<any>(null),
};

type SyncOptions = {
  skipPullAfterSuccessfulHabitLogPush?: boolean;
};

type PushPhaseOptions = {
  toastHabitLogFailures?: boolean;
};

type PushPhaseResult = {
  usedBulkSync: boolean;
  attemptedIndividualHabitLogPush: boolean;
  individualHabitLogPushFailed: boolean;
};

export const INITIAL_SYNC_HISTORY_DAYS = 90;

const isConflictError = (e: any) => {
  return (e.statusCode || e.response?.status) === 409;
};

// For testing only
export const _resetSyncState = () => {
  try {
    useState('h_isSyncing').value = false;
    useState('h_syncNeeded').value = false;
    useState('h_skipPullAfterHabitLogPush').value = false;
    useState('h_retryCount').value = 0;
    const timer = useState<any>('h_retryTimer');
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
  } catch {
    // Fallback for tests where useState is not defined
    _testSyncState.isSyncing.value = false;
    _testSyncState.syncNeeded.value = false;
    _testSyncState.skipPullAfterHabitLogPush.value = false;
    _testSyncState.retryCount.value = 0;
    if (_testSyncState.retryTimer.value) {
      clearTimeout(_testSyncState.retryTimer.value);
      _testSyncState.retryTimer.value = null;
    }
  }
};

export const useHabitsApi = () => {
  const client = useHabitsClient();
  const store = useHabitsStore();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  
  // Sync Engine State (SSR-Safe)
  let isSyncing: Ref<boolean>;
  let syncNeeded: Ref<boolean>;
  let skipPullAfterHabitLogPush: Ref<boolean>;
  let retryCount: Ref<number>;
  let retryTimer: Ref<any>;

  try {
    isSyncing = useState('h_isSyncing', () => false);
    syncNeeded = useState('h_syncNeeded', () => false);
    skipPullAfterHabitLogPush = useState('h_skipPullAfterHabitLogPush', () => false);
    retryCount = useState('h_retryCount', () => 0);
    retryTimer = useState<any>('h_retryTimer', () => null);
  } catch {
    isSyncing = _testSyncState.isSyncing;
    syncNeeded = _testSyncState.syncNeeded;
    skipPullAfterHabitLogPush = _testSyncState.skipPullAfterHabitLogPush;
    retryCount = _testSyncState.retryCount;
    retryTimer = _testSyncState.retryTimer;
  }
  
  let lastSyncTime: Ref<number>;
  try {
    lastSyncTime = useState('last-sync-time', () => 0);
  } catch {
    lastSyncTime = ref(0);
  }

  const triggerSync = (options: SyncOptions = {}) => {
    // Reset backoff on manual/explicit actions
    retryCount.value = 0;
    if (retryTimer.value) {
      clearTimeout(retryTimer.value);
      retryTimer.value = null;
    }
    sync(options).catch(err => console.error('[Sync] Background sync failed:', err));
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

    triggerSync(isOnline.value ? { skipPullAfterSuccessfulHabitLogPush: true } : {});
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
  const sync = async (options: SyncOptions = {}) => {
    if (!user.value || !process.client) return;

    if (options.skipPullAfterSuccessfulHabitLogPush) {
      skipPullAfterHabitLogPush.value = true;
    }
    
    // Atomic Concurrency Lock
    if (isSyncing.value) {
      syncNeeded.value = true;
      return;
    }
    isSyncing.value = true;

    const PAGES_PER_CYCLE = 10;
    let pagesFetched = 0;

    try {
      do {
        syncNeeded.value = false;
        const skipPullForSuccessfulHabitLogPush = skipPullAfterHabitLogPush.value;
        skipPullAfterHabitLogPush.value = false;

        // 0. Process Action Queue & Unsynced Changes (Push Phase)
        const pushResult = await processPushPhase({
          toastHabitLogFailures: skipPullForSuccessfulHabitLogPush
        });

        const shouldSkipPull =
          skipPullForSuccessfulHabitLogPush &&
          pushResult.attemptedIndividualHabitLogPush &&
          !pushResult.individualHabitLogPushFailed &&
          !pushResult.usedBulkSync;

        if (shouldSkipPull) {
          continue;
        }

        // 1. Check for stored cursors to resume
        const state = await db.syncState.get('current');
        let currentCursors = state?.cursors || {};
        let hasMore = true;

        // 2. Pull remote changes in pages
        while (hasMore && pagesFetched < PAGES_PER_CYCLE) {
          const queryParams: any = { limit: 50, cursors: currentCursors };
          
          if (state?.lastSynced) {
            queryParams.lastSynced = state.lastSynced;
          } else {
            // Initial Sync Window: Strictly bounded for battery/data while keeping enough recent history.
            queryParams.startDate = format(subDays(new Date(), INITIAL_SYNC_HISTORY_DAYS), 'yyyy-MM-dd');
            queryParams.endDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');
          }

          const response = await client.fetchSync(queryParams) as SyncResponse;
          
          if (response.forceUpdateRequired) {
            // Safe Force Reset: We already pushed changes above, now we can safely wipe and reset
            await db.transaction('rw', [db.habits, db.buckets, db.habitLogs, db.bucketLogs, db.habitStreakBaselines, db.syncState], async () => {
              // Delete all local data that has been synced (preserve unsynced local changes)
              await db.habits.where('synced').equals(1).delete();
              await db.buckets.where('synced').equals(1).delete();
              await db.habitLogs.where('synced').equals(1).delete();
              await db.bucketLogs.where('synced').equals(1).delete();
              await db.habitStreakBaselines.clear();
              await db.syncState.clear();
            });

            currentCursors = {};
            pagesFetched = 0; // Restart count for the clean pull
            continue; 
          }

          const { 
            habits: remoteHabits, 
            buckets: remoteBuckets, 
            habitLogs: remoteLogs, 
            bucketLogs: remoteBucketLogs, 
            deletions: remoteDeletions, 
            habitStreakBaselines: remoteHabitStreakBaselines = [],
            serverTime, 
            nextCursors, 
            hasMore: remoteHasMore 
          } = response;

          // Atomic Transaction for the current page
          await db.transaction('rw', [db.habits, db.buckets, db.habitLogs, db.bucketLogs, db.habitStreakBaselines, db.syncState], async () => {
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

            for (const baseline of remoteHabitStreakBaselines) {
              await db.habitStreakBaselines.put({
                ...baseline,
                updatedAt: Date.now()
              });
            }

            // Save state for resume-ability
            await db.syncState.put({
              id: 'current',
              lastSynced: serverTime,
              cursors: remoteHasMore ? nextCursors : {}
            });
          });

          currentCursors = nextCursors;
          hasMore = remoteHasMore || false;
          pagesFetched++;
          lastSyncTime.value = serverTime;
        }

        // Cleanup: If finished, we can eventually clear cursors (handled in transaction above if !hasMore)
        if (!hasMore) {
          await db.syncState.update('current', { cursors: {} });
        } else if (pagesFetched >= PAGES_PER_CYCLE) {
          // Schedule continuation to yield to main thread
          if (retryTimer.value) clearTimeout(retryTimer.value);
          retryTimer.value = setTimeout(() => {
            retryTimer.value = null;
            sync().catch(console.error);
          }, 2000);
          return; // Terminate current execution
        }

      } while (syncNeeded.value);

      // On success, reset backoff
      retryCount.value = 0;
    } catch (error: any) {
      handleSyncError(error);
    } finally {
      isSyncing.value = false;
    }
  };

  const processPushPhase = async (options: PushPhaseOptions = {}): Promise<PushPhaseResult> => {
    const result: PushPhaseResult = {
      usedBulkSync: false,
      attemptedIndividualHabitLogPush: false,
      individualHabitLogPushFailed: false
    };

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
          if (d.id) await db.syncQueue.delete(d.id);
          showToast("A queued action could not be saved.", "failed");
        } else {
          throw e;
        }
      }
    }

    // 1. Push local changes (Habits, Logs, Buckets)
    // Defense-in-depth: only push data belonging to the current user
    const currentUserId = user.value?.id;
    if (!currentUserId) return result;

    const unsyncedHabits = await db.habits.where('synced').notEqual(1).filter(h => h.ownerId === currentUserId).toArray();
    const unsyncedLogs = await db.habitLogs.where('synced').equals(0).filter(l => l.ownerId === currentUserId).toArray();
    const unsyncedBuckets = await db.buckets.where('synced').notEqual(1).filter(b => b.ownerId === currentUserId).toArray();
    const unsyncedBucketLogs = await db.bucketLogs.where('synced').equals(0).filter(l => l.ownerId === currentUserId).toArray();

    const totalUnsynced = unsyncedHabits.length + unsyncedLogs.length + unsyncedBuckets.length + unsyncedBucketLogs.length;

    if (totalUnsynced > 1) {
      result.usedBulkSync = true;
      const operations: any[] = [];

      // Habits first
      for (const h of unsyncedHabits) {
        const { currentStreak, longestStreak, streakAnchorDate, ...habitPayload } = h;
        operations.push({ type: 'habit', data: { ...habitPayload, id: h.id } });
      }

      // Then Buckets
      for (const b of unsyncedBuckets) {
        const { currentStreak, longestStreak, streakAnchorDate, ...bucketPayload } = b;
        operations.push({ type: 'bucket', data: { ...bucketPayload, id: b.id } });
      }

      // Then Logs
      for (const l of unsyncedLogs) {
        const { streakCount, brokenStreakCount, ...logPayload } = l;
        operations.push({ type: 'log', data: { ...logPayload, id: l.id } });
      }

      // Then Bucket Logs
      for (const l of unsyncedBucketLogs) {
        const { streakCount, brokenStreakCount, ...logPayload } = l;
        operations.push({ type: 'bucketLog', data: { ...logPayload, id: l.id } });
      }

      // Chunk into batches of 100
      for (let i = 0; i < operations.length; i += 100) {
        const chunk = operations.slice(i, i + 100);
        const res = await client.postBulkSync({ operations: chunk });

        // Update local state based on response
        await db.transaction('rw', [db.habits, db.buckets, db.habitLogs, db.bucketLogs], async () => {
          for (const id of res.success) {
            const op = chunk.find(o => o.data.id === id);
            if (op) {
              if (op.type === 'habit') await db.habits.update(id, { synced: 1 });
              else if (op.type === 'bucket') await db.buckets.update(id, { synced: 1 });
              else if (op.type === 'log') await db.habitLogs.update(id, { synced: 1 });
              else if (op.type === 'bucketLog') await db.bucketLogs.update(id, { synced: 1 });
            }
          }
        });
      }
    } else {
      // Individual Sync (Existing Logic)
      for (const h of unsyncedHabits) {
        try {
          const isNew = (h as any).synced === 0;
          const { currentStreak, longestStreak, streakAnchorDate, ...habitPayload } = h;
          const res = isNew ? await client.postHabit(habitPayload) : await client.putHabit(h.id, habitPayload);
          await db.habits.update(h.id, { synced: 1, id: res.data.id, userDate: res.data.userDate });
        } catch (e: any) {
          if (isConflictError(e)) { await db.habits.update(h.id, { synced: 1 }); continue; }
          const status = e.statusCode || e.response?.status;
          if (status === 404) { await store.deleteHabit(h.id); await store.removeHabitFromBuckets(h.id); }
          else if (status >= 400 && status < 500 && status !== 429) { 
            await db.habits.update(h.id, { synced: 1 }); 
            if (e.data?.code === 'HABIT_LIMIT_REACHED') {
              showToast("Habit limit of 30 reached on the server. Some habits may not sync.", "failed");
            } else {
              showToast("A habit update could not be saved.", "failed"); 
            }
          }
          else throw e;
        }
      }

      for (const l of unsyncedLogs) {
        result.attemptedIndividualHabitLogPush = true;
        try {
          const { streakCount, brokenStreakCount, ...logPayload } = l;
          await client.postHabitLog(logPayload);
          await db.habitLogs.update(l.id, { synced: 1 });
        } catch (e: any) {
          result.individualHabitLogPushFailed = true;
          if (isConflictError(e)) {
            await db.habitLogs.update(l.id, { synced: 1 });
            if (options.toastHabitLogFailures) showToast("Habit log update failed", "failed");
            continue;
          }
          const status = e.statusCode || e.response?.status;
          if (status >= 400 && status < 500 && status !== 429) {
            await db.habitLogs.delete(l.id);
            showToast(options.toastHabitLogFailures ? "Habit log update failed" : "A habit log could not be saved.", "failed");
          }
          else throw e;
        }
      }

      for (const b of unsyncedBuckets) {
        try {
          const isNew = (b as any).synced === 0;
          const { currentStreak, longestStreak, streakAnchorDate, ...bucketPayload } = b;
          const res = isNew ? await client.postBucket(bucketPayload) : await client.putBucket(b.id, bucketPayload);
          await db.buckets.update(b.id, { synced: 1, id: res.data.id });
        } catch (e: any) {
          if (isConflictError(e)) { await db.buckets.update(b.id, { synced: 1 }); continue; }
          const status = e.statusCode || e.response?.status;
          if (status === 404) { await db.buckets.delete(b.id); }
          else if (status >= 400 && status < 500 && status !== 429) { 
            await db.buckets.update(b.id, { synced: 1 }); 
            if (e.data?.code === 'BUCKET_LIMIT_REACHED') {
              showToast("Bucket limit of 50 reached on the server. Some buckets may not sync.", "failed");
            } else {
              showToast("A bucket update could not be saved.", "failed"); 
            }
          }
          else throw e;
        }
      }

      for (const l of unsyncedBucketLogs) {
        try {
          const { streakCount, brokenStreakCount, ...logPayload } = l;
          await client.postBucketLog(logPayload);
          await db.bucketLogs.update(l.id, { synced: 1 });
        } catch (e: any) {
          if (isConflictError(e)) { await db.bucketLogs.update(l.id, { synced: 1 }); continue; }
          const status = e.statusCode || e.response?.status;
          if (status >= 400 && status < 500 && status !== 429) { await db.bucketLogs.delete(l.id); showToast("A bucket log could not be saved.", "failed"); }
          else throw e;
        }
      }
    }

    return result;
  };

  const handleSyncError = (error: any) => {
    const status = error.statusCode || error.response?.status;
    if (status >= 400 && status < 500 && status !== 429) {
      console.error('[Sync] Sync failed (Terminal):', error);
    } else {
      console.warn('[Sync] Transient error, scheduling backoff retry...', error);
      retryCount.value++;
      const baseDelay = Math.min(Math.pow(2, retryCount.value) * 1000, 300000);
      const jitterDelay = Math.random() * baseDelay;
      if (retryTimer.value) clearTimeout(retryTimer.value);
      retryTimer.value = setTimeout(() => {
        retryTimer.value = null;
        sync().catch(console.error);
      }, jitterDelay);
    }
  };

  const fetchHistory = async (startDate: string, endDate: string) => {
    if (!user.value || !process.client) return;
    try {
      const response = await client.fetchSync({ startDate, endDate });
      const {
        habits: remoteHabits,
        buckets: remoteBuckets,
        habitLogs: remoteLogs,
        bucketLogs: remoteBucketLogs,
        habitStreakBaselines: remoteHabitStreakBaselines = []
      } = response;

      await db.transaction('rw', [db.habits, db.buckets, db.habitLogs, db.bucketLogs, db.habitStreakBaselines], async () => {
        for (const h of remoteHabits) {
          await db.habits.put({ ...h, synced: 1, updatedAt: Date.now() } as any);
        }
        for (const b of remoteBuckets) {
          await db.buckets.put({ ...b, synced: 1, updatedAt: Date.now() } as any);
        }
        for (const l of remoteLogs) {
          await db.habitLogs.put({ ...l, synced: 1, updatedAt: Date.now() } as any);
        }
        for (const bl of remoteBucketLogs) {
          await db.bucketLogs.put({ ...bl, synced: 1, updatedAt: Date.now() } as any);
        }
        for (const baseline of remoteHabitStreakBaselines) {
          await db.habitStreakBaselines.put({
            ...baseline,
            updatedAt: Date.now()
          });
        }
      });
    } catch (error) {
      console.error('[Sync] History fetch failed:', error);
      showToast("Could not fetch historical data.", "failed");
    }
  };

  return {
    getHabits, createHabit, updateHabit, deleteHabit, getLogs, upsertLog, deleteLog, reorderHabits,
    getBuckets, createBucket, updateBucket, deleteBucket, getBucketLogs, reorderBuckets,
    sync, lastSyncTime, fetchHistory,
    habits, buckets
  };
};
