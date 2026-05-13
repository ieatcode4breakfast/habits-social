import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestHabitLog, createTestBucket, deleteTestBucket, User, Habit, Bucket, db } from './test.utils';
import { syncBucketLogsForHabit, reevaluateMultipleBuckets } from '../utils/buckets';
import { formatISO, addDays } from 'date-fns';
import { eq, and } from 'drizzle-orm';
import { bucketHabits, habitLogs, bucketLogs, buckets } from '../db/schema';

describe('Bucket Streak Calculation - Alignment with Habit Streaks', () => {
  let user: User;
  let habitA: Habit;
  let habitB: Habit;
  let bucket: Bucket;

  const startDate = new Date('2024-05-01T00:00:00.000Z');
  const d = (offset: number) => formatISO(addDays(startDate, offset), { representation: 'date' });

  beforeAll(async () => {
    user = await createTestUser(`bstreak_${Date.now()}`, `bstreak_${Date.now()}@ex.com`);
    habitA = await createTestHabit(user.id, 'Bucket Habit A');
    habitB = await createTestHabit(user.id, 'Bucket Habit B');
    bucket = await createTestBucket(user.id, 'Streak Test Bucket');

    // Link both habits to the bucket
    await db.insert(bucketHabits).values([
      { bucketId: bucket.id, habitId: habitA.id, addedBy: user.id, approvalStatus: 'accepted' },
      { bucketId: bucket.id, habitId: habitB.id, addedBy: user.id, approvalStatus: 'accepted' },
    ]);
  });

  afterAll(async () => {
    if (user?.id) {
      await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
      await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, user.id));
    }
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (habitB?.id) await deleteTestHabit(habitB.id);
    if (bucket?.id) await deleteTestBucket(bucket.id);
    if (user?.id) await deleteTestUser(user.id);
  });

  it('should compute correct bucket streak when a cleared day exists in the middle', async () => {
    // Days 0-4: Both habits completed (5 days)
    // Day 5: Only habitA completed, habitB missing → bucket = 'cleared'
    // Days 6-11: Both habits completed (6 days)
    // Expected bucket streak: 6 (NOT 11)

    const logsToInsert = [];
    for (let i = 0; i <= 11; i++) {
      if (i !== 5) {
        // Both habits completed on all days except Day 5
        logsToInsert.push(
          { id: `${habitA.id}_${d(i)}`, habitId: habitA.id, ownerId: user.id, date: d(i), status: 'completed' as const, updatedAt: new Date() },
          { id: `${habitB.id}_${d(i)}`, habitId: habitB.id, ownerId: user.id, date: d(i), status: 'completed' as const, updatedAt: new Date() }
        );
      } else {
        // Day 5: only habitA completed
        logsToInsert.push(
          { id: `${habitA.id}_${d(i)}`, habitId: habitA.id, ownerId: user.id, date: d(i), status: 'completed' as const, updatedAt: new Date() }
        );
      }
    }
    await db.insert(habitLogs).values(logsToInsert);

    // Trigger bucket reevaluation (full rebuild)
    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);

    // Verify the bucket log for Day 5 is 'cleared'
    const day5Log = await db.select().from(bucketLogs)
      .where(and(eq(bucketLogs.bucketId, bucket.id), eq(bucketLogs.date, d(5))));
    expect(day5Log[0]?.status).toBe('cleared');

    // Verify bucket streak
    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(6);
    expect(bucketRes[0]!.longestStreak).toBe(6);
  }, 30000);

  it('should compute correct bucket streak via syncBucketLogsForHabit (incremental path)', async () => {
    // Clean up previous test data
    await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
    await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, user.id));
    await db.update(buckets).set({ currentStreak: 0, longestStreak: 0, streakAnchorDate: null }).where(eq(buckets.id, bucket.id));

    // Day 0-2: Both habits completed
    for (let i = 0; i <= 2; i++) {
      await createTestHabitLog(user.id, habitA.id, d(i), 'completed');
      await createTestHabitLog(user.id, habitB.id, d(i), 'completed');
      // Trigger the per-habit sync (simulates the real-time flow)
      await syncBucketLogsForHabit(db, habitB.id, user.id, d(i));
    }

    // Day 3: Only habitA completed → bucket should be 'cleared'
    await createTestHabitLog(user.id, habitA.id, d(3), 'completed');
    await syncBucketLogsForHabit(db, habitA.id, user.id, d(3));

    // Day 4-5: Both habits completed again
    for (let i = 4; i <= 5; i++) {
      await createTestHabitLog(user.id, habitA.id, d(i), 'completed');
      await createTestHabitLog(user.id, habitB.id, d(i), 'completed');
      await syncBucketLogsForHabit(db, habitB.id, user.id, d(i));
    }

    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(2);
  }, 30000);

  it('should break streak on failed bucket log just like habit streaks', async () => {
    // Clean up
    await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
    await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, user.id));
    await db.update(buckets).set({ currentStreak: 0, longestStreak: 0, streakAnchorDate: null }).where(eq(buckets.id, bucket.id));

    // Day 0-2: Both completed
    for (let i = 0; i <= 2; i++) {
      await createTestHabitLog(user.id, habitA.id, d(i), 'completed');
      await createTestHabitLog(user.id, habitB.id, d(i), 'completed');
    }

    // Day 3: habitA = failed, habitB = completed → bucket = 'failed'
    await createTestHabitLog(user.id, habitA.id, d(3), 'failed');
    await createTestHabitLog(user.id, habitB.id, d(3), 'completed');

    // Day 4: Both completed
    await createTestHabitLog(user.id, habitA.id, d(4), 'completed');
    await createTestHabitLog(user.id, habitB.id, d(4), 'completed');

    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);

    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(1);
    expect(bucketRes[0]!.longestStreak).toBe(3);
  }, 30000);

  it('should protect streak on vacation/skipped bucket log just like habit streaks', async () => {
    // Clean up
    await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
    await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, user.id));
    await db.update(buckets).set({ currentStreak: 0, longestStreak: 0, streakAnchorDate: null }).where(eq(buckets.id, bucket.id));

    // Day 0-1: Both completed (streak = 2)
    for (let i = 0; i <= 1; i++) {
      await createTestHabitLog(user.id, habitA.id, d(i), 'completed');
      await createTestHabitLog(user.id, habitB.id, d(i), 'completed');
    }

    // Day 2: Both vacation → bucket = 'vacation' (streak protected, stays 2)
    await createTestHabitLog(user.id, habitA.id, d(2), 'vacation');
    await createTestHabitLog(user.id, habitB.id, d(2), 'vacation');

    // Day 3: Both completed (streak = 3)
    await createTestHabitLog(user.id, habitA.id, d(3), 'completed');
    await createTestHabitLog(user.id, habitB.id, d(3), 'completed');

    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);

    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(3);
  }, 30000);
});
