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

  it('removeHabitFromBuckets cleans up habit references', async () => {
    const store = useHabitsStore();
    
    // Setup bucket with habit
    await db.buckets.add({
      id: 'bucket-1',
      ownerId: 'test-user-id',
      title: 'Bucket 1',
      habitIds: ['habit-1', 'habit-2'],
      synced: 1,
      updatedAt: Date.now()
    } as any);

    await store.removeHabitFromBuckets('habit-1');

    const bucket = await db.buckets.get('bucket-1');
    expect(bucket?.habitIds).toEqual(['habit-2']);
    // Should mark as unsynced (-1)
    expect(bucket?.synced).toBe(-1);
  });
});
