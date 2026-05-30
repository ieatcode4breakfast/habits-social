import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { INITIAL_SYNC_HISTORY_DAYS, useHabitsApi, _resetSyncState } from './useHabitsApi';

// Mock dependencies
const mockClient = {
  fetchSync: vi.fn(),
  postHabit: vi.fn(),
};

const mockStore = {
  getHabits: vi.fn(() => []),
  getBuckets: vi.fn(() => []),
  getOwnerId: vi.fn(() => 'u1'),
  deleteHabit: vi.fn(),
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

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: ref(true) })
}));

const mockCollection = {
  toArray: vi.fn(() => []),
  filter: vi.fn(function(this: any) { return this; }),
  delete: vi.fn(),
  modify: vi.fn(),
};

const mockWhere = {
  notEqual: vi.fn(() => mockCollection),
  equals: vi.fn(() => mockCollection),
  anyOf: vi.fn(() => mockCollection),
};

let mockSyncStateRecords: Record<string, Record<string, unknown>> = {};

vi.mock('~/utils/db', () => ({
  db: {
    syncQueue: { 
      toArray: vi.fn(() => []), 
      delete: vi.fn() 
    },
    habits: { 
      where: vi.fn(() => mockWhere), 
      get: vi.fn(), 
      update: vi.fn(),
      put: vi.fn()
    },
    habitLogs: { 
      where: vi.fn(() => mockWhere), 
      update: vi.fn(), 
      delete: vi.fn(),
      put: vi.fn(),
      get: vi.fn()
    },
    buckets: { 
      where: vi.fn(() => mockWhere), 
      update: vi.fn(), 
      delete: vi.fn(),
      put: vi.fn(),
      get: vi.fn()
    },
    bucketLogs: { 
      where: vi.fn(() => mockWhere), 
      update: vi.fn(), 
      delete: vi.fn(),
      put: vi.fn(),
      get: vi.fn()
    },
    habitStreakBaselines: {
      put: vi.fn(),
      clear: vi.fn()
    },
    syncState: (() => {
      return {
        get: vi.fn(id => Promise.resolve(mockSyncStateRecords[id])),
        put: vi.fn(val => { mockSyncStateRecords[val.id] = val; }),
        update: vi.fn((id, val) => { mockSyncStateRecords[id] = { ...(mockSyncStateRecords[id] ?? {}), ...val }; }),
        clear: vi.fn(() => { mockSyncStateRecords = {}; })
      };
    })(),
    transaction: vi.fn((mode, tables, callback) => callback())
  }
}));

describe('useHabitsApi - V2 Resilience & Pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('process', { client: true });
    vi.stubGlobal('useState', (key: string, fallback: () => any) => ref(fallback()));
    
    mockClient.fetchSync.mockReset();
    mockClient.postHabit.mockReset();
    mockSyncStateRecords = {};
    _resetSyncState();
  });

  it('should persist cursors in a transaction after each page', async () => {
    const { db } = await import('~/utils/db');
    
    // Mock response with more data
    mockClient.fetchSync.mockResolvedValueOnce({
      habits: [{ id: 'h1', title: 'H1' }],
      buckets: [],
      habitLogs: [],
      bucketLogs: [],
      serverTime: 1000,
      nextCursors: { habits: 'c1' },
      hasMore: true
    }).mockResolvedValueOnce({
      habits: [{ id: 'h2', title: 'H2' }],
      buckets: [],
      habitLogs: [],
      bucketLogs: [],
      serverTime: 2000,
      nextCursors: { habits: 'c2' },
      hasMore: false
    });

    const api = useHabitsApi();
    await api.sync();

    // Verify transaction was called for each page
    expect(db.transaction).toHaveBeenCalled();
    
    // Verify syncState was updated with cursors
    expect(db.syncState.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'current',
      cursors: { habits: 'c1' }
    }));
  });

  it('should request a 90-day bounded window on initial sync', async () => {
    vi.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    mockClient.fetchSync.mockResolvedValue({
      habits: [],
      buckets: [],
      habitLogs: [],
      bucketLogs: [],
      serverTime: 1000,
      nextCursors: {},
      hasMore: false
    });

    const api = useHabitsApi();
    await api.sync();

    expect(INITIAL_SYNC_HISTORY_DAYS).toBe(90);
    expect(mockClient.fetchSync).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-03-01',
      endDate: '2026-06-29'
    }));
  });

  it('should respect the iteration cap (10 pages) and schedule continuation', async () => {
    // Mock 11 pages
    for (let i = 0; i < 11; i++) {
      mockClient.fetchSync.mockResolvedValueOnce({
        habits: [{ id: `h${i}`, title: `H${i}` }],
        buckets: [],
        habitLogs: [],
        bucketLogs: [],
        serverTime: 1000 + i,
        nextCursors: { habits: `c${i}` },
        hasMore: true
      });
    }

    const api = useHabitsApi();
    await api.sync();

    // Should have only called fetchSync 10 times in the first cycle
    expect(mockClient.fetchSync).toHaveBeenCalledTimes(10);
    
    // Reset mock implementation and calls to see continuation
    mockClient.fetchSync.mockReset();
    mockClient.fetchSync.mockResolvedValue({
      habits: [],
      buckets: [],
      habitLogs: [],
      bucketLogs: [],
      serverTime: 2000,
      nextCursors: {},
      hasMore: false
    });

    await vi.runAllTimersAsync();
    expect(mockClient.fetchSync).toHaveBeenCalled();
  });

  it('should push local changes before force reset when server returns forceUpdateRequired', async () => {
    const { db } = await import('~/utils/db');
    const unsyncedHabit = { id: 'h_local', title: 'Local', synced: 0 };
    const api = useHabitsApi();
    
    // Set up the unsynced habit return
    (mockCollection.toArray as any).mockResolvedValueOnce([unsyncedHabit]);
    (db.habits.get as any).mockResolvedValue(unsyncedHabit);

    mockClient.postHabit.mockResolvedValue({ data: { id: 'h_local' } });
    mockClient.fetchSync
      .mockResolvedValueOnce({ forceUpdateRequired: true })
      .mockResolvedValueOnce({ habits: [], buckets: [], habitLogs: [], bucketLogs: [], serverTime: 2000, hasMore: false });

    await api.sync();

    // Verify push happened
    expect(mockClient.postHabit).toHaveBeenCalled();
    
    // Verify baseline wipe (deleting synced records)
    expect(db.habits.where).toHaveBeenCalledWith('synced');
    
    // Verify syncState was cleared after push but before final pull
    expect(db.syncState.clear).toHaveBeenCalled();
  });
});
