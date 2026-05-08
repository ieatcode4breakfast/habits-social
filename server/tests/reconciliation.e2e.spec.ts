import './setup';
import { describe, it, expect, beforeEach } from 'vitest';
import syncGet from '../api/sync.get';
import { createMockEvent, createTestUser, db } from './test.utils';
import { habits } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('E2E Reconciliation: Sorting Validation', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`e2e_sync_${Date.now()}`, `e2e_sync_${Date.now()}@example.com`);
  });

  it('should return habits in the exact order of their sortOrder (UI Consistency)', async () => {
    // 1. Seed habits with non-sequential sort orders
    const habitData = [
      { id: crypto.randomUUID(), title: 'Habit 10', sortOrder: 10, ownerId: testUser.id },
      { id: crypto.randomUUID(), title: 'Habit 5', sortOrder: 5, ownerId: testUser.id },
      { id: crypto.randomUUID(), title: 'Habit 20', sortOrder: 20, ownerId: testUser.id },
      { id: crypto.randomUUID(), title: 'Habit 0', sortOrder: 0, ownerId: testUser.id },
      { id: crypto.randomUUID(), title: 'Habit 15', sortOrder: 15, ownerId: testUser.id },
    ];

    await db.insert(habits).values(habitData);

    // 2. Perform sync
    const event = createMockEvent(testUser.id);
    const res = await syncGet(event);

    // 3. Validate sorting (should be 0, 5, 10, 15, 20)
    const returnedOrders = res.habits.map((h: any) => h.sortOrder);
    expect(returnedOrders).toEqual([0, 5, 10, 15, 20]);
  });

  it('should handle "Dirty Writes" (Concurrent Update) by returning the latest state', async () => {
    // 1. Create a habit
    const habitId = crypto.randomUUID();
    await db.insert(habits).values({
      id: habitId,
      title: 'Original Title',
      ownerId: testUser.id,
      sortOrder: 0
    });

    // 2. Simulate an update just before sync (in a real scenario, this would be another process)
    await db.update(habits)
      .set({ title: 'Updated Title', updatedAt: new Date() })
      .where(eq(habits.id, habitId));

    // 3. Sync
    const event = createMockEvent(testUser.id);
    const res = await syncGet(event);

    const habit = res.habits.find((h: any) => h.id === habitId);
    expect(habit.title).toBe('Updated Title');
  });
});
