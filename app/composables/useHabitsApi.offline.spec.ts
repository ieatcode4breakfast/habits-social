import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useHabitsApi, _resetSyncState } from './useHabitsApi';

const mockClient = {
  fetchSync: vi.fn(),
  postHabit: vi.fn(),
  postHabitLog: vi.fn(),
};

const mockStore = {
  getHabits: vi.fn(() => []),
  getBuckets: vi.fn(() => []),
  getOwnerId: vi.fn(() => 'u1'),
  putHabit: vi.fn(),
  putLog: vi.fn(),
  syncLocalBucketLogs: vi.fn(),
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

// Mock useNetwork as OFFLINE
const isOnlineRef = ref(false);
vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: isOnlineRef })
}));

vi.mock('~/utils/db', () => ({
  db: {
    syncQueue: { toArray: vi.fn(() => []), delete: vi.fn(), add: vi.fn() },
    habits: { where: vi.fn(() => ({ notEqual: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })), get: vi.fn(), update: vi.fn(), put: vi.fn() },
    habitLogs: { where: vi.fn(() => ({ equals: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })), update: vi.fn(), delete: vi.fn(), put: vi.fn() },
    buckets: { where: vi.fn(() => ({ notEqual: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })), update: vi.fn(), delete: vi.fn(), put: vi.fn() },
    bucketLogs: { where: vi.fn(() => ({ equals: vi.fn(() => ({ filter: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) })), update: vi.fn(), delete: vi.fn(), put: vi.fn() },
    syncState: {
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  }
}));

describe('useHabitsApi - Offline', () => {
  beforeEach(() => {
    isOnlineRef.value = false;
    vi.stubGlobal('process', { client: true });
    mockClient.fetchSync.mockReset();
    mockClient.postHabit.mockReset();
    mockClient.postHabitLog.mockReset();
    mockToast.showToast.mockReset();
    _resetSyncState();
  });

  it('sync() returns immediately without network calls when offline', async () => {
    const api = useHabitsApi();
    await api.sync();
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });

  it('triggerSync() does not run sync when offline', async () => {
    const api = useHabitsApi();
    api.triggerSync();
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });

  it('ensureHistoryLoadedForDate() does not fetch history when offline', async () => {
    const api = useHabitsApi();
    // Set earliestFetchedDate to a date in future relative to target to trigger load
    api.earliestFetchedDate.value = '2026-06-10';
    await api.ensureHistoryLoadedForDate('2026-06-05');
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });

  it('fetchHistory() returns early when offline', async () => {
    const api = useHabitsApi();
    await api.fetchHistory('2026-06-01', '2026-06-05');
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
    expect(mockToast.showToast).not.toHaveBeenCalled();
  });
});
