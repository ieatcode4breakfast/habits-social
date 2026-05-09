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

const mockCollection = {
  toArray: vi.fn(() => []),
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
    }
  }
}));

import { db } from '~/utils/db';

describe('useHabitsApi - Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sync() pulls remote changes and merges them into store', async () => {
    const remoteData = {
      habits: [{ id: 'h1', title: 'Remote Habit' }],
      buckets: [],
      habitLogs: [],
      bucketLogs: [],
      serverTime: 10000
    };
    mockClient.fetchSync.mockResolvedValue(remoteData);
    (db.habits.get as any).mockResolvedValue(null); // No local conflict

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.fetchSync).toHaveBeenCalled();
    expect(db.habits.put as any).toHaveBeenCalledWith(expect.objectContaining({
      id: 'h1',
      title: 'Remote Habit',
      synced: 1
    }));
  });

  it('sync() pushes local unsynced habits', async () => {
    const unsyncedHabit = { id: 'local-h1', title: 'Local Habit', synced: 0 };
    (db.habits.where as any).mockReturnValue({
      notEqual: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([unsyncedHabit])
    });
    (db.habits.get as any).mockResolvedValue(unsyncedHabit);
    mockClient.postHabit.mockResolvedValue({ data: { id: 'remote-id', userDate: '2026-01-01' } });
    mockClient.fetchSync.mockResolvedValue({ serverTime: 10000, habits: [], buckets: [], habitLogs: [], bucketLogs: [] });

    const api = useHabitsApi();
    await api.sync();

    expect(mockClient.postHabit).toHaveBeenCalledWith(unsyncedHabit);
    expect(db.habits.update as any).toHaveBeenCalledWith('local-h1', expect.objectContaining({
      synced: 1,
      id: 'remote-id'
    }));
  });
});
