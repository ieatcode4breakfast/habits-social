import './setup';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, createTestBucket, db } from './test.utils';
import { habits as habitsTable, buckets as bucketsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { recalculateHabitStreak } from '../utils/streaks';

describe('BOLA Core Security Tests', () => {
  let userA: any;
  let userB: any;
  let habitA: any;
  let bucketA: any;

  beforeAll(async () => {
    userA = await createTestUser(`bola_core_a_${Date.now()}`, `bola_ca_${Date.now()}@ex.com`);
    userB = await createTestUser(`bola_core_b_${Date.now()}`, `bola_cb_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  beforeEach(async () => {
    habitA = await createTestHabit(userA.id, 'User A Habit');
    bucketA = await createTestBucket(userA.id, 'User A Bucket');
  });

  afterEach(async () => {
    if (habitA?.id) await db.delete(habitsTable).where(eq(habitsTable.id, habitA.id));
    if (bucketA?.id) await db.delete(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
  });

  it('Case 1: Unauthorized Habit Deletion', async () => {
    const { HabitService } = await import('../services/habit.service');
    
    try {
      await HabitService.deleteHabit(db, userB.id, habitA.id, {});
    } catch (e: any) {
    }

    const check = await db.select().from(habitsTable).where(eq(habitsTable.id, habitA.id));
    expect(check.length).toBe(1); // Habit should still exist
  });

  it('Case 2: Unauthorized Bucket Deletion', async () => {
    const { BucketService } = await import('../services/bucket.service');
    
    try {
      await BucketService.deleteBucket(db, userB.id, bucketA.id, {});
    } catch (e: any) {
    }

    const check = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
    expect(check.length).toBe(1); // Bucket should still exist
  });

  it('Case 3: Unauthorized Bucket Update', async () => {
    const { BucketService } = await import('../services/bucket.service');
    
    try {
      await BucketService.updateBucket(db, userB.id, bucketA.id, { title: 'Hacked Title' }, bucketA, {});
    } catch (e: any) {
    }

    const check = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketA.id));
    expect(check.length).toBe(1);
    expect(check[0]?.title).toBe('User A Bucket'); // Title should not have changed
  });

  it('Case 4: Streak Hijacking (Direct Utility Call)', async () => {
    // User A has a habit. We'll manually update it to have a streak of 10.
    await db.update(habitsTable)
      .set({ currentStreak: 10, longestStreak: 10 })
      .where(eq(habitsTable.id, habitA.id));

    // User B calls recalculateHabitStreak for habitA, but with their own userId.
    // Since User B has no logs for this habit, it might reset the streak to 0.
    await recalculateHabitStreak(db, habitA.id, userB.id);

    const check = await db.select().from(habitsTable).where(eq(habitsTable.id, habitA.id));
    expect(check.length).toBe(1);
    expect(check[0]?.currentStreak).toBe(10); // Streak should still be 10
  });
});
