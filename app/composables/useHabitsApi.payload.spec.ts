import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Nuxt composables BEFORE importing useHabitsApi
vi.mock('#app', () => ({
  useState: vi.fn((key, init) => ({ value: init ? init() : null })),
  useNuxtApp: vi.fn(() => ({})),
  useRequestHeaders: vi.fn(() => ({})),
}));

vi.mock('nuxt/app', () => ({
  useState: vi.fn((key, init) => ({ value: init ? init() : null })),
  useNuxtApp: vi.fn(() => ({})),
  useRequestHeaders: vi.fn(() => ({})),
}));

import { useHabitsApi } from './useHabitsApi';

// Mock dependencies
const mockClient = {
  fetchSync: vi.fn(),
  postHabit: vi.fn(),
  putHabit: vi.fn(),
  deleteHabit: vi.fn(),
  postReorderHabits: vi.fn(),
  postHabitLog: vi.fn(),
  postBucket: vi.fn(),
  putBucket: vi.fn(),
  deleteBucket: vi.fn(),
  postReorderBuckets: vi.fn(),
  postBucketLog: vi.fn(),
  postBulkSync: vi.fn().mockResolvedValue({ success: [], failed: [] }),
};

const mockStore = {
  getHabits: vi.fn(),
  putHabit: vi.fn(),
  deleteHabit: vi.fn(),
  updateHabit: vi.fn(),
  getLogs: vi.fn(),
  putLog: vi.fn(),
  deleteLog: vi.fn(),
  getBuckets: vi.fn(),
  putBucket: vi.fn(),
  deleteBucket: vi.fn(),
  updateBucket: vi.fn(),
  getBucketLogs: vi.fn(),
  putBucketLog: vi.fn(),
  removeHabitFromBuckets: vi.fn(),
  syncLocalBucketLogs: vi.fn(),
  generateId: vi.fn(() => 'test-id'),
  getOwnerId: vi.fn(() => 'test-user-id'),
};

vi.mock('./useHabitsClient', () => ({
  useHabitsClient: () => mockClient
}));

vi.mock('./useHabitsStore', () => ({
  useHabitsStore: () => mockStore
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: { value: { id: 'test-user-id' } } })
}));

const mockShowToast = vi.fn();
vi.mock('./useToast', () => ({
  useToast: () => ({ showToast: mockShowToast })
}));

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: { value: true } })
}));

const mockCollection = {
  toArray: vi.fn(() => []),
  filter: vi.fn(function(this: any) { return this; }),
  modify: vi.fn(),
};

const mockWhere = {
  notEqual: vi.fn(() => mockCollection),
  equals: vi.fn(() => mockCollection),
  anyOf: vi.fn(() => mockCollection),
};

// Mock db for syncQueue
vi.mock('~/utils/db', () => ({
  db: {
    syncQueue: {
      toArray: vi.fn(() => []),
      delete: vi.fn(),
    },
    habits: {
      where: vi.fn(() => mockWhere),
      get: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      put: vi.fn(),
    },
    habitLogs: {
      where: vi.fn(() => mockWhere),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    },
    buckets: {
      where: vi.fn(() => mockWhere),
      get: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(() => []),
    },
    bucketLogs: {
      where: vi.fn(() => mockWhere),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    },
    syncState: {
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    },
    transaction: vi.fn((mode, tables, cb) => cb()),
  }
}));

import { db } from '~/utils/db';

describe('useHabitsApi - Payload Minimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults for mocks that return chainable objects
    mockCollection.toArray.mockResolvedValue([]);
    mockCollection.filter.mockReturnValue(mockCollection);
    
    // Reset where mocks to prevent state leak between tests
    (db.habits.where as any).mockReturnValue(mockWhere);
    (db.buckets.where as any).mockReturnValue(mockWhere);
    (db.habitLogs.where as any).mockReturnValue(mockWhere);
    (db.bucketLogs.where as any).mockReturnValue(mockWhere);
  });

  it('sync() strips derived fields from habits before pushing', async () => {
    const unsyncedHabit = { 
      id: 'local-h1', 
      title: 'Local Habit', 
      synced: 0,
      ownerId: 'test-user-id',
      currentStreak: 5,
      longestStreak: 10,
      streakAnchorDate: '2026-01-01'
    };
    
    (db.habits.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedHabit])
        })
      })
    });
    
    mockClient.postHabit.mockResolvedValue({ data: { id: 'remote-id', userDate: '2026-01-01' } });
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.postHabit).toHaveBeenCalled();
    const callArgs = mockClient.postHabit.mock.calls[0]![0];
    expect(callArgs.currentStreak).toBeUndefined();
    expect(callArgs.longestStreak).toBeUndefined();
    expect(callArgs.streakAnchorDate).toBeUndefined();
    expect(callArgs.title).toBe('Local Habit');
  });

  it('sync() strips derived fields from buckets before pushing', async () => {
    const unsyncedBucket = { 
      id: 'local-b1', 
      title: 'Local Bucket', 
      synced: 0,
      ownerId: 'test-user-id',
      currentStreak: 5,
      longestStreak: 10,
      streakAnchorDate: '2026-01-01'
    };
    
    (db.buckets.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedBucket])
        })
      })
    });
    
    mockClient.postBucket.mockResolvedValue({ data: { id: 'remote-id' } });
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.postBucket).toHaveBeenCalled();
    const callArgs = mockClient.postBucket.mock.calls[0]![0];
    expect(callArgs.currentStreak).toBeUndefined();
    expect(callArgs.longestStreak).toBeUndefined();
    expect(callArgs.streakAnchorDate).toBeUndefined();
    expect(callArgs.title).toBe('Local Bucket');
  });

  it('sync() strips derived fields from habit logs before pushing', async () => {
    const unsyncedLog = { 
      id: 'local-l1', 
      habitId: 'h1',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'completed',
      streakCount: 5,
      brokenStreakCount: 2
    };
    
    (db.habitLogs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedLog])
        })
      })
    });
    
    mockClient.postHabitLog.mockResolvedValue({});
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.postHabitLog).toHaveBeenCalled();
    const callArgs = mockClient.postHabitLog.mock.calls[0]![0];
    expect(callArgs.streakCount).toBeUndefined();
    expect(callArgs.brokenStreakCount).toBeUndefined();
    expect(callArgs.status).toBe('completed');
  });

  it('sync() skips the pull after a successful targeted individual habit log push', async () => {
    const unsyncedLog = {
      id: 'local-l1',
      habitId: 'h1',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'completed'
    };

    (db.habitLogs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedLog])
        })
      })
    });

    mockClient.postHabitLog.mockResolvedValue({});
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync({ skipPullAfterSuccessfulHabitLogPush: true });

    expect(mockClient.postHabitLog).toHaveBeenCalledWith(unsyncedLog);
    expect(db.habitLogs.update).toHaveBeenCalledWith('local-l1', { synced: 1 });
    expect(mockClient.fetchSync).not.toHaveBeenCalled();
  });

  it('sync() pulls server data after a failed targeted individual habit log push', async () => {
    const unsyncedLog = {
      id: 'local-l1',
      habitId: 'h1',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'completed'
    };
    const validationError = new Error('Invalid habit log');
    Object.assign(validationError, { statusCode: 400 });

    (db.habitLogs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedLog])
        })
      })
    });

    mockClient.postHabitLog.mockRejectedValue(validationError);
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync({ skipPullAfterSuccessfulHabitLogPush: true });

    expect(mockShowToast).toHaveBeenCalledWith('Habit log update failed', 'failed');
    expect(db.habitLogs.delete).toHaveBeenCalledWith('local-l1');
    expect(mockClient.fetchSync).toHaveBeenCalled();
  });

  it('sync() keeps the normal pull after targeted mode falls back to bulk sync', async () => {
    const unsyncedLogA = {
      id: 'local-l1',
      habitId: 'h1',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'completed'
    };
    const unsyncedLogB = {
      id: 'local-l2',
      habitId: 'h2',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'failed'
    };

    (db.habitLogs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedLogA, unsyncedLogB])
        })
      })
    });

    mockClient.postBulkSync.mockResolvedValue({ success: ['local-l1', 'local-l2'], failed: [] });
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync({ skipPullAfterSuccessfulHabitLogPush: true });

    expect(mockClient.postBulkSync).toHaveBeenCalled();
    expect(mockClient.fetchSync).toHaveBeenCalled();
  });

  it('sync() strips derived fields from bucket logs before pushing', async () => {
    const unsyncedBucketLog = { 
      id: 'local-bl1', 
      bucketId: 'b1',
      synced: 0,
      ownerId: 'test-user-id',
      status: 'completed',
      streakCount: 5,
      brokenStreakCount: 2
    };
    
    (db.bucketLogs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedBucketLog])
        })
      })
    });
    
    mockClient.postBucketLog.mockResolvedValue({});
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.postBucketLog).toHaveBeenCalled();
    const callArgs = mockClient.postBucketLog.mock.calls[0]![0];
    expect(callArgs.streakCount).toBeUndefined();
    expect(callArgs.brokenStreakCount).toBeUndefined();
    expect(callArgs.status).toBe('completed');
  });

  it('sync() shows limit toast when habit limit is reached', async () => {
    const unsyncedHabit = { id: 'local-h1', title: 'Local Habit', synced: 0, ownerId: 'test-user-id' };
    
    (db.habits.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedHabit])
        })
      })
    });
    
    const limitError = new Error('Habit limit reached');
    (limitError as any).statusCode = 400;
    (limitError as any).data = { code: 'HABIT_LIMIT_REACHED' };
    
    mockClient.postHabit.mockRejectedValue(limitError);
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockShowToast).toHaveBeenCalledWith("Habit limit of 30 reached on the server. Some habits may not sync.", "failed");
  });

  it('sync() shows limit toast when bucket limit is reached', async () => {
    const unsyncedBucket = { id: 'local-b1', title: 'Local Bucket', synced: 0, ownerId: 'test-user-id' };
    
    (db.buckets.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([unsyncedBucket])
        })
      })
    });
    
    const limitError = new Error('Bucket limit reached');
    (limitError as any).statusCode = 400;
    (limitError as any).data = { code: 'BUCKET_LIMIT_REACHED' };
    
    mockClient.postBucket.mockRejectedValue(limitError);
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockShowToast).toHaveBeenCalledWith("Bucket limit of 50 reached on the server. Some buckets may not sync.", "failed");
  });
});
