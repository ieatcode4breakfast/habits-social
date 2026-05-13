import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket, User, Habit, Bucket, db } from './test.utils';
import { recalculateHabitStreak } from '../utils/streaks';
import { reevaluateMultipleBuckets } from '../utils/buckets';
import { formatISO, addDays } from 'date-fns';
import { eq, and, sql } from 'drizzle-orm';
import { bucketHabits, habitLogs, bucketLogs, buckets, habits } from '../db/schema';

describe('Streak Calculation Engine - Stress Testing', () => {
  let user: User;
  let habit: Habit;
  let bucket: Bucket;

  beforeAll(async () => {
    user = await createTestUser(`stress_${Date.now()}`, `stress_${Date.now()}@ex.com`);
    habit = await createTestHabit(user.id, '5 Day Habit');
    bucket = await createTestBucket(user.id, '5 Day Bucket');

    // Link habit to bucket
    await db.insert(bucketHabits)
      .values({
        bucketId: bucket.id,
        habitId: habit.id,
        addedBy: user.id,
        approvalStatus: 'accepted'
      });
  });

  afterAll(async () => {
    // Delete logs explicitly as cascade might not be guaranteed in tests
    if (user?.id) {
      await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
      await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, user.id));
    }
    if (habit?.id) await deleteTestHabit(habit.id);
    if (bucket?.id) await deleteTestBucket(bucket.id);
    if (user?.id) await deleteTestUser(user.id);
  });

  it('should process a 5-day uninterrupted streak for both habit and bucket', async () => {
    const STREAK_DAYS = 5;
    const startDate = new Date('2020-01-01T00:00:00.000Z');

    const logsToInsert = [];
    const now = new Date();

    for (let i = 0; i < STREAK_DAYS; i++) {
      const current = addDays(startDate, i);
      const dateStr = formatISO(current, { representation: 'date' });
      logsToInsert.push({
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr,
        status: 'completed' as const,
        streakCount: 0,
        brokenStreakCount: 0,
        updatedAt: now
      });
    }

    // Batch insert
    await db.insert(habitLogs).values(logsToInsert);

    // 2. Trigger recalculation
    const habitResult = await recalculateHabitStreak(db, habit.id, user.id);
    
    // Assert habit counts
    expect(habitResult!.currentStreak).toBe(STREAK_DAYS);
    expect(habitResult!.longestStreak).toBe(STREAK_DAYS);

    // 3. Trigger bucket reevaluation
    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);
    
    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(STREAK_DAYS);
    expect(bucketRes[0]!.longestStreak).toBe(STREAK_DAYS);
  }, 60000);

  it('should correctly reset streaks on a gap and recalculate forward', async () => {
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    // Day 5 is skipped (gap)
    // Log Day 6 as completed
    const day6 = addDays(startDate, 6);
    const dateStr6 = formatISO(day6, { representation: 'date' });

    await db.insert(habitLogs)
      .values({
        id: habit.id + '_' + dateStr6,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr6,
        status: 'completed',
        updatedAt: new Date()
      });

    const habitResult = await recalculateHabitStreak(db, habit.id, user.id, dateStr6);
    
    // Due to the 1-day gap (day 5), the streak should reset. 
    expect(habitResult!.currentStreak).toBe(1);
    expect(habitResult!.longestStreak).toBe(5);

    // Bucket should follow same logic
    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);
    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(1);
    expect(bucketRes[0]!.longestStreak).toBe(5);
  }, 60000);

  it('should correctly cascade a failure inserted into the middle of the history', async () => {
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    // Change Day 2 to 'failed'
    const day2 = addDays(startDate, 2);
    const dateStr2 = formatISO(day2, { representation: 'date' });

    await db.update(habitLogs)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(
        eq(habitLogs.habitId, habit.id),
        eq(habitLogs.ownerId, user.id),
        eq(habitLogs.date, dateStr2)
      ));

    // Recalculate forward from day 2
    const habitResult = await recalculateHabitStreak(db, habit.id, user.id, dateStr2);
    
    expect(habitResult!.currentStreak).toBe(1);
    expect(habitResult!.longestStreak).toBe(2); // Days 3,4 = 2 days

    // Ensure the log stamped the broken streak correctly
    const failedLog = await db.select()
      .from(habitLogs)
      .where(eq(habitLogs.id, `${habit.id}_${dateStr2}`));
    expect(failedLog[0]!.brokenStreakCount).toBe(2); // Broke the initial 2 day streak (Days 0,1)

    // Reevaluate Bucket
    await reevaluateMultipleBuckets(db, [{ bucketId: bucket.id, ownerId: user.id }]);
    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(1);
    expect(bucketRes[0]!.longestStreak).toBe(2);
  }, 60000);

  it('should maintain streak without incrementing on skipped or vacation', async () => {
    // Add logs for Day 7 (skipped) and Day 8 (completed)
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    const day7 = addDays(startDate, 7);
    const day8 = addDays(startDate, 8);
    const dateStr7 = formatISO(day7, { representation: 'date' });
    const dateStr8 = formatISO(day8, { representation: 'date' });

    await db.insert(habitLogs).values([
      {
        id: habit.id + '_' + dateStr7,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr7,
        status: 'skipped' as const,
        updatedAt: new Date()
      },
      {
        id: habit.id + '_' + dateStr8,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr8,
        status: 'completed' as const,
        updatedAt: new Date()
      }
    ]);

    const habitResult = await recalculateHabitStreak(db, habit.id, user.id, dateStr7);
    // Prior to Day 7, current streak was 1 (from Day 6).
    // Day 7 is skipped -> streak remains 1
    // Day 8 is completed -> streak becomes 2
    expect(habitResult!.currentStreak).toBe(2);
  }, 60000);

  it('should maintain streak count on cleared status', async () => {
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    const day9 = addDays(startDate, 9);
    const dateStr9 = formatISO(day9, { representation: 'date' });

    await db.insert(habitLogs)
      .values({
        id: habit.id + '_' + dateStr9,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr9,
        status: 'cleared',
        updatedAt: new Date()
      });

    const habitResult = await recalculateHabitStreak(db, habit.id, user.id, dateStr9);
    // Day 9 cleared -> streak remains 2 (from Day 8)
    expect(habitResult!.currentStreak).toBe(2);
  }, 60000);

  it('PERFORMANCE: should process 365 days of historical logs without timeout', async () => {
    const STREAK_DAYS = 365;
    const startDate = new Date('2021-01-01T00:00:00.000Z');
    const logsToInsert = [];
    const now = new Date();

    for (let i = 0; i < STREAK_DAYS; i++) {
      const current = addDays(startDate, i);
      const dateStr = formatISO(current, { representation: 'date' });
      logsToInsert.push({
        id: `${habit.id}_${dateStr}`,
        habitId: habit.id,
        ownerId: user.id,
        date: dateStr,
        status: 'completed' as const,
        updatedAt: now
      });
    }

    // Batch insert 365 logs
    await db.insert(habitLogs).values(logsToInsert);

    const startTime = Date.now();
    const habitResult = await recalculateHabitStreak(db, habit.id, user.id);
    const duration = Date.now() - startTime;

    console.log(`[Stress Test] 365-day recalculation took ${duration}ms`);
    
    expect(habitResult!.currentStreak).toBe(365);
    expect(duration).toBeLessThan(10000); // Should definitely be under 10s
  }, 120000);
});
