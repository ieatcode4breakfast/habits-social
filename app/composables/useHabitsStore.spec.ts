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
      id: 'bucket-1_2023-01-01',
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
    const bucketLog = await db.bucketLogs.get('bucket-1_2023-01-01');
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
      id: 'b-empty_2023-01-01',
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
    
    const log = await db.bucketLogs.get('b-empty_2023-01-01');
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
      id: 'b-purge_2023-01-01',
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
    const bucketLog = await db.bucketLogs.get('b-purge_2023-01-01');
    expect(bucketLog).toBeUndefined();
  });

  it('syncLocalBucketLogs ignores pending habits and handles cleared status', async () => {
    const store = useHabitsStore();
    const date = '2023-01-01';
    
    // 1. Setup bucket with 1 accepted habit and 1 pending habit
    await db.buckets.add({
      id: 'b1',
      ownerId: 'test-user-id',
      habitIds: ['h-accepted', 'h-pending'],
      sharedHabits: [
        { habitId: 'h-accepted', approvalStatus: 'accepted', addedBy: 'u1', habitOwnerId: 'u1' },
        { habitId: 'h-pending', approvalStatus: 'pending', addedBy: 'u1', habitOwnerId: 'u1' }
      ],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    // 2. Add 'completed' log for the accepted habit
    await db.habitLogs.add({
      id: 'log-1',
      habitId: 'h-accepted',
      ownerId: 'test-user-id',
      date,
      status: 'completed',
      sharedWith: [],
      synced: 1,
      updatedAt: Date.now()
    });

    // 3. Trigger sync for the accepted habit log
    // This should NOT result in 'cleared' because 'h-pending' is ignored
    await store.syncLocalBucketLogs('h-accepted', date);

    const bucketLog = await db.bucketLogs.get(`b1_${date}`);
    expect(bucketLog).toBeDefined();
    expect(bucketLog?.status).toBe('completed');

    // 4. Now make another habit accepted but missing a log
    await db.buckets.update('b1', {
      sharedHabits: [
        { habitId: 'h-accepted', approvalStatus: 'accepted', addedBy: 'u1', habitOwnerId: 'u1' },
        { habitId: 'h-pending', approvalStatus: 'accepted', addedBy: 'u1', habitOwnerId: 'u1' } // now it counts!
      ]
    });

    await store.syncLocalBucketLogs('h-accepted', date);
    const updatedLog = await db.bucketLogs.get(`b1_${date}`);
    expect(updatedLog?.status).toBe('cleared'); // Should be cleared now because h-pending is missing a log
  });
});
