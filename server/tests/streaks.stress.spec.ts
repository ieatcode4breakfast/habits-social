import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket } from './test.utils';
import { recalculateHabitStreak } from '../utils/streaks';
import { reevaluateBucketLogs, syncSingleBucketLog } from '../utils/buckets';
import { formatISO, addDays } from 'date-fns';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, sql } from 'drizzle-orm';
import { bucketHabits, habitLogs, bucketLogs, buckets, habits } from '../db/schema';
import * as schema from '../db/schema';

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

describe('Streak Calculation Engine - Stress Testing', () => {
  let user: any;
  let habit: any;
  let bucket: any;

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
    await reevaluateBucketLogs(db, bucket.id, user.id);
    
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
    await syncSingleBucketLog(db, bucket.id, user.id, dateStr6);
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
    await reevaluateBucketLogs(db, bucket.id, user.id);
    const bucketRes = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    expect(bucketRes[0]!.currentStreak).toBe(1);
    expect(bucketRes[0]!.longestStreak).toBe(2);
  }, 60000);
});
