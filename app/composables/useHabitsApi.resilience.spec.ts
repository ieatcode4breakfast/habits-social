import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useHabitsApi, _resetSyncState } from './useHabitsApi';

// Mock dependencies
const mockClient = {
  fetchSync: vi.fn(),
  postHabit: vi.fn(),
};

const mockStore = {
  getHabits: vi.fn(() => []),
  getBuckets: vi.fn(() => []),
  getOwnerId: vi.fn(() => 'u1'),
};

const mockToast = {
  showToast: vi.fn(),
};

vi.mock('./useHabitsClient', () => ({
  useHabitsClient: () => mockClient
}));

vi.mock('./useHabitsStore', () => ({
  useHabitsStore: () => mockStore
}));

vi.mock('./useToast', () => ({
  useToast: () => mockToast
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: ref({ id: 'u1' }) })
}));

// Mock @vueuse/core
vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: ref(true) })
}));

vi.mock('~/utils/db', () => ({
  db: {
    syncQueue: { toArray: vi.fn(() => []), delete: vi.fn() },
    habits: { where: vi.fn(() => ({ notEqual: vi.fn(() => ({ toArray: vi.fn(() => []) })) })), get: vi.fn(), update: vi.fn() },
    habitLogs: { where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => []) })) })), update: vi.fn(), delete: vi.fn() },
    buckets: { where: vi.fn(() => ({ notEqual: vi.fn(() => ({ toArray: vi.fn(() => []) })) })), update: vi.fn(), delete: vi.fn() },
    bucketLogs: { where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => []) })) })), update: vi.fn(), delete: vi.fn() },
    syncState: {
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  }
}));

describe('useHabitsApi - Resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure sync logic is not skipped due to client check
    vi.stubGlobal('process', { client: true });
    
    mockClient.fetchSync.mockReset();
    mockClient.postHabit.mockReset();
    mockStore.getHabits.mockReset();
    mockToast.showToast.mockReset();
    _resetSyncState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sync() enforces an atomic concurrency lock', async () => {
    vi.useRealTimers(); // Real timers for this test to avoid fake timer await issues
    let resolveSync: any;
    const syncPromise = new Promise(resolve => { resolveSync = resolve; });
    mockClient.fetchSync.mockReturnValue(syncPromise);

    const api = useHabitsApi();
    
    // First call starts
    const firstCall = api.sync();
    
    // Give it a tiny bit of real time to reach the first await
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Second call while first is active
    await api.sync();
    
    expect(mockClient.fetchSync).toHaveBeenCalledTimes(1);
    
    resolveSync({ habits: [], buckets: [], habitLogs: [], bucketLogs: [], serverTime: 1000 });
    await firstCall;
  });

  it('sync() triggers exponential backoff with jitter on 500 error', async () => {
    mockClient.fetchSync.mockRejectedValue({ statusCode: 500 });

    const api = useHabitsApi();
    await api.sync();

    // Verify a retry timer was scheduled by advancing time and checking calls
    // We expect 1 call (the initial one that failed)
    expect(mockClient.fetchSync).toHaveBeenCalledTimes(1);
    
    // Reset mock to track the retry
    mockClient.fetchSync.mockReset();
    mockClient.fetchSync.mockResolvedValue({ habits: [], buckets: [], habitLogs: [], bucketLogs: [], serverTime: 1000 });
    
    // Advance time by the max possible jitter for first retry (2000ms)
    await vi.advanceTimersByTimeAsync(2001);
    
    // Should have retried
    expect(mockClient.fetchSync).toHaveBeenCalledTimes(1);
  });

  it('sync() drops item and notifies user on 400 error', async () => {
    const { db } = await import('~/utils/db');
    const unsyncedHabit = { id: 'h1', title: 'Bad Habit', synced: 0 };
    (db.habits.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([unsyncedHabit])
    });
    (db.habits.get as any).mockResolvedValue(unsyncedHabit);
    
    mockClient.postHabit.mockRejectedValue({ statusCode: 400 });
    mockClient.fetchSync.mockResolvedValue({ habits: [], buckets: [], habitLogs: [], bucketLogs: [], serverTime: 1000 });

    const api = useHabitsApi();
    await api.sync();

    // Verify item marked as synced (dropped) and toast shown
    expect(db.habits.update).toHaveBeenCalledWith('h1', { synced: 1 });
    expect(mockToast.showToast).toHaveBeenCalledWith(expect.stringContaining('not be saved'), 'failed');
    
    // Verify NO retry is scheduled
    mockClient.fetchSync.mockClear();
    await vi.advanceTimersByTimeAsync(300000);
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });

  it('sync() treats 409 Conflict as a successful sync and does not retry or show toast', async () => {
    const { db } = await import('~/utils/db');
    const unsyncedHabit = { id: 'h_conflict', title: 'Conflict Habit', synced: 0 };
    (db.habits.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([unsyncedHabit])
    });
    (db.habits.get as any).mockResolvedValue(unsyncedHabit);
    
    // Simulate 409 Conflict
    mockClient.postHabit.mockRejectedValue({ statusCode: 409 });
    mockClient.fetchSync.mockResolvedValue({ habits: [], buckets: [], habitLogs: [], bucketLogs: [], serverTime: 1000 });

    const api = useHabitsApi();
    await api.sync();

    // Verify item marked as synced
    expect(db.habits.update).toHaveBeenCalledWith('h_conflict', { synced: 1 });
    
    // Verify NO toast shown for conflict
    expect(mockToast.showToast).not.toHaveBeenCalled();
    
    // Verify NO retry is scheduled
    mockClient.fetchSync.mockClear();
    await vi.advanceTimersByTimeAsync(300000);
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });
});
