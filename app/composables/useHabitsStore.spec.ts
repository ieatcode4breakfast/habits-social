import { describe, it, expect, beforeEach } from 'vitest';
import { useHabitsStore } from './useHabitsStore';
import { db } from '~/utils/db';

describe('useHabitsStore', () => {
  beforeEach(async () => {
    await db.habits.clear();
    await db.buckets.clear();
    await db.habitLogs.clear();
    await db.syncQueue.clear();
  });

  it('putHabit stores a habit in Dexie', async () => {
    const store = useHabitsStore();
    const habitData = { id: 'test-habit', title: 'Test Habit', ownerId: 'test-user-id' };
    
    await store.putHabit(habitData as any);
    
    const stored = await db.habits.get('test-habit');
    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Test Habit');
  });

  it('generateId produces a valid string', () => {
    const store = useHabitsStore();
    const id = (store as any).generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('removeHabitFromBuckets cleans up habit references and triggers recalculation', async () => {
    const store = useHabitsStore();
    const date = '2023-01-01';
    
    // Setup bucket with two habits
    await db.buckets.add({
      id: 'bucket-1',
      ownerId: 'test-user-id',
      title: 'Bucket 1',
      habitIds: ['habit-1', 'habit-2'],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    // Add log only for habit-2 (bucket will be 'cleared' because habit-1 is missing)
    await db.habitLogs.add({
      id: 'h2-log',
      habitId: 'habit-2',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    // Create initial bucket log
    await db.bucketLogs.add({
      id: 'bucket-1_2023-01-01_test-user-id',
      bucketId: 'bucket-1',
      ownerId: 'test-user-id',
      date,
      status: 'cleared',
      streakCount: 0,
      synced: 1,
      updatedAt: Date.now()
    } as any);

    // Action: Remove habit-1 (the one that was missing)
    await store.removeHabitFromBuckets('habit-1');

    const bucket = await db.buckets.get('bucket-1');
    expect(bucket?.habitIds).toEqual(['habit-2']);
    
    // Status should promote from 'cleared' to 'completed'
    const bucketLog = await db.bucketLogs.get('bucket-1_2023-01-01_test-user-id');
    expect(bucketLog?.status).toBe('completed');
    
    // Deep Assertion: Verify streakCount stamping on the log
    expect(bucketLog?.streakCount).toBe(1);
    
    // Verify parent streak update
    expect(bucket?.currentStreak).toBe(1);
  });

  it('removeHabitFromBuckets cleans up empty buckets', async () => {
    const store = useHabitsStore();
    
    await db.buckets.add({
      id: 'b-empty',
      ownerId: 'test-user-id',
      habitIds: ['h-last'],
      currentStreak: 5,
      synced: 1,
      updatedAt: Date.now()
    } as any);

    await db.bucketLogs.add({
      id: 'b-empty_2023-01-01_test-user-id',
      bucketId: 'b-empty',
      ownerId: 'test-user-id',
      date: '2023-01-01',
      status: 'completed',
      synced: 1,
      updatedAt: Date.now()
    } as any);

    await store.removeHabitFromBuckets('h-last');

    const bucket = await db.buckets.get('b-empty');
    expect(bucket?.habitIds).toEqual([]);
    expect(bucket?.currentStreak).toBe(0);
    
    const log = await db.bucketLogs.get('b-empty_2023-01-01_test-user-id');
    expect(log).toBeUndefined();
  });

  it('removeHabitFromBuckets purges zero-activity bucket logs', async () => {
    const store = useHabitsStore();
    const date = '2023-01-01';

    // Habit A (to be removed) has activity. Habit B (remaining) has NO activity.
    await db.buckets.add({
      id: 'b-purge',
      ownerId: 'test-user-id',
      habitIds: ['habit-a', 'habit-b'],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    await db.habitLogs.add({
      id: 'ha-log',
      habitId: 'habit-a',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    // Bucket log exists because Habit A was completed (but Habit B missing -> cleared)
    await db.bucketLogs.add({
      id: 'b-purge_2023-01-01_test-user-id',
      bucketId: 'b-purge',
      ownerId: 'test-user-id',
      date,
      status: 'cleared',
      synced: 1,
      updatedAt: Date.now()
    } as any);

    // Action: Remove Habit A (the only one with activity)
    await store.removeHabitFromBuckets('habit-a');

    // Assertion: The bucket log should be DELETED because remaining Habit B has no activity
    const bucketLog = await db.bucketLogs.get('b-purge_2023-01-01_test-user-id');
    expect(bucketLog).toBeUndefined();
  });

  it('syncLocalBucketLogs handles cleared status when a habit is missing a log', async () => {
    const store = useHabitsStore();
    const date = '2023-01-01';
    
    // 1. Setup bucket with 2 habits
    await db.buckets.add({
      id: 'b1',
      ownerId: 'test-user-id',
      habitIds: ['h1', 'h2'],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    // 2. Add 'completed' log for h1 (h2 is missing log)
    await db.habitLogs.add({
      id: 'log-1',
      habitId: 'h1',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    // 3. Trigger sync for h1 log
    // This should result in 'cleared' because h2 is in the bucket but has no log on this date
    await store.syncLocalBucketLogs('h1', date);

    const bucketLog = await db.bucketLogs.get(`b1_${date}_test-user-id`);
    expect(bucketLog).toBeDefined();
    expect(bucketLog?.status).toBe('cleared');

    // 4. Add 'completed' log for h2
    await db.habitLogs.add({
      id: 'log-2',
      habitId: 'h2',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    await store.syncLocalBucketLogs('h2', date);
    const updatedLog = await db.bucketLogs.get(`b1_${date}_test-user-id`);
    expect(updatedLog?.status).toBe('completed');
  });

  it('syncLocalBucketLogs generates ID with ownerId suffix', async () => {
    const store = useHabitsStore();
    const date = '2023-01-01';
    
    await db.buckets.add({
      id: 'b-id-test',
      ownerId: 'test-user-id',
      habitIds: ['h-1'],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    await db.habitLogs.add({
      id: 'l-1',
      habitId: 'h-1',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    await store.syncLocalBucketLogs('h-1', date);

    const bucketLog = await db.bucketLogs.get(`b-id-test_${date}_test-user-id`);
    expect(bucketLog).toBeDefined();
    expect(bucketLog?.status).toBe('completed');

    const oldFormatLog = await db.bucketLogs.get(`b-id-test_${date}`);
    expect(oldFormatLog).toBeUndefined();
  });
});
