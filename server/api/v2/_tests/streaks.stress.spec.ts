import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket } from './test.utils';
import { recalculateHabitStreak } from '../_utils/streaks';
import { reevaluateBucketLogs, syncSingleBucketLog } from '../_utils/buckets';
import { formatISO, addDays } from 'date-fns';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

describe('Streak Calculation Engine - Stress Testing', () => {
  let user: any;
  let habit: any;
  let bucket: any;

  beforeAll(async () => {
    user = await createTestUser(`stress_${Date.now()}`, `stress_${Date.now()}@ex.com`);
    habit = await createTestHabit(user.id, '5 Day Habit');
    bucket = await createTestBucket(user.id, '5 Day Bucket');

    // Link habit to bucket
    await sql`
      INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
      VALUES (${bucket.id}::uuid, ${habit.id}::uuid, ${user.id}, 'accepted')
    `;
  });

  afterAll(async () => {
    // Delete logs explicitly as cascade might not be guaranteed in tests
    await sql`DELETE FROM habit_logs WHERE owner_id = ${user?.id}`;
    await sql`DELETE FROM bucket_logs WHERE owner_id = ${user?.id}`;
    if (habit?.id) await deleteTestHabit(habit.id);
    if (bucket?.id) await deleteTestBucket(bucket.id);
    if (user?.id) await deleteTestUser(user.id);
  });

  it('should process a 5-day uninterrupted streak for both habit and bucket', async () => {
    const STREAK_DAYS = 5;
    const startDate = new Date('2020-01-01T00:00:00.000Z');

    // 1. Generate 5 continuous logs
    const ids = [];
    const habitIds = [];
    const ownerIds = [];
    const dates = [];
    const statuses = [];
    const zeros = [];
    const times = [];

    const now = new Date().toISOString();

    for (let i = 0; i < STREAK_DAYS; i++) {
      const current = addDays(startDate, i);
      const dateStr = formatISO(current, { representation: 'date' });
      ids.push(`${habit.id}_${dateStr}`);
      habitIds.push(habit.id);
      ownerIds.push(user.id);
      dates.push(dateStr);
      statuses.push('completed');
      zeros.push(0);
      times.push(now);
    }

    // Batch insert directly into DB to bypass API 14-day limit
    await sql`
      INSERT INTO habit_logs (id, habit_id, owner_id, date, status, streak_count, broken_streak_count, updated_at)
      SELECT * FROM UNNEST(
        ${ids}::text[], 
        ${habitIds}::uuid[], 
        ${ownerIds}::uuid[], 
        ${dates}::date[], 
        ${statuses}::text[], 
        ${zeros}::int[], 
        ${zeros}::int[], 
        ${times}::timestamp[]
      )
    `;

    // 2. Trigger recalculation
    const habitResult = await recalculateHabitStreak(sql, habit.id, user.id);
    
    // Assert habit counts
    expect(habitResult!.current_streak).toBe(STREAK_DAYS);
    expect(habitResult!.longest_streak).toBe(STREAK_DAYS);

    // 3. Trigger bucket reevaluation
    await reevaluateBucketLogs(sql, bucket.id, user.id);
    
    const bucketRes = await sql`SELECT current_streak, longest_streak FROM buckets WHERE id = ${bucket.id}::uuid`;
    expect(bucketRes[0]!.current_streak).toBe(STREAK_DAYS);
    expect(bucketRes[0]!.longest_streak).toBe(STREAK_DAYS);
  }, 60000);

  it('should correctly reset streaks on a gap and recalculate forward', async () => {
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    // Day 5 is skipped (gap)
    // Log Day 6 as completed
    const day6 = addDays(startDate, 6);
    const dateStr6 = formatISO(day6, { representation: 'date' });

    await sql`
      INSERT INTO habit_logs (id, habit_id, owner_id, date, status, updated_at)
      VALUES (${habit.id + '_' + dateStr6}, ${habit.id}::uuid, ${user.id}, ${dateStr6}, 'completed', NOW())
    `;

    const habitResult = await recalculateHabitStreak(sql, habit.id, user.id, dateStr6);
    
    // Due to the 1-day gap (day 5), the streak should reset. 
    // The previous 5 streak remains the longest.
    // The current is 1 (for day 6).
    expect(habitResult!.current_streak).toBe(1);
    expect(habitResult!.longest_streak).toBe(5);

    // Bucket should follow same logic
    await syncSingleBucketLog(sql, bucket.id, user.id, dateStr6);
    const bucketRes = await sql`SELECT current_streak, longest_streak FROM buckets WHERE id = ${bucket.id}::uuid`;
    expect(bucketRes[0]!.current_streak).toBe(1);
    expect(bucketRes[0]!.longest_streak).toBe(5);
  }, 60000);

  it('should correctly cascade a failure inserted into the middle of the history', async () => {
    const startDate = new Date('2020-01-01T00:00:00.000Z');
    // Change Day 2 to 'failed'
    const day2 = addDays(startDate, 2);
    const dateStr2 = formatISO(day2, { representation: 'date' });

    await sql`
      UPDATE habit_logs SET status = 'failed' 
      WHERE habit_id = ${habit.id}::uuid AND owner_id = ${user.id} AND date = ${dateStr2}
    `;

    // Recalculate forward from day 2
    const habitResult = await recalculateHabitStreak(sql, habit.id, user.id, dateStr2);
    
    expect(habitResult!.current_streak).toBe(1);
    // Fixed: incremental updates should now correctly shrink longestStreak
    expect(habitResult!.longest_streak).toBe(2); // Days 3,4 = 2 days

    // Ensure the log stamped the broken streak correctly
    const failedLog = await sql`SELECT broken_streak_count FROM habit_logs WHERE id = ${`${habit.id}_${dateStr2}`}`;
    expect(failedLog[0]!.broken_streak_count).toBe(2); // Broke the initial 2 day streak (Days 0,1)

    // Reevaluate Bucket
    await reevaluateBucketLogs(sql, bucket.id, user.id);
    const bucketRes = await sql`SELECT current_streak, longest_streak FROM buckets WHERE id = ${bucket.id}::uuid`;
    expect(bucketRes[0]!.current_streak).toBe(1);
    expect(bucketRes[0]!.longest_streak).toBe(2);
  }, 60000);
});



