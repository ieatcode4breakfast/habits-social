
import { describe, it, expect, beforeEach } from 'vitest';
import { db, createTestUser, createTestHabit, createTestHabitLog, createTestBucket } from './test.utils';
import { users, habits, habitLogs, buckets } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Referential Integrity & Cascade Deletes', () => {
  let user: any;

  beforeEach(async () => {
    // Cleanup existing users with this email if any
    await db.delete(users).where(eq(users.email, 'integrity-test@example.com'));
    user = await createTestUser('integrity_test', 'integrity-test@example.com');
  });

  it('should prevent creating a habit for a non-existent user (Orphan Prevention)', async () => {
    const randomUuid = crypto.randomUUID();
    
    // Attempting to insert a habit with a random UUID should fail due to foreign key constraint
    await expect(createTestHabit(randomUuid, 'Orphan Habit'))
      .rejects.toThrow();
  });

  it('should automatically delete all user data when the user is deleted (User Cascade)', async () => {
    // 1. Create habit, log, and bucket
    const habit = await createTestHabit(user.id, 'Cascade Habit');
    const log = await createTestHabitLog(user.id, habit.id, '2026-05-09');
    const bucket = await createTestBucket(user.id, 'Cascade Bucket');

    // 2. Verify they exist
    const habitCheck = await db.select().from(habits).where(eq(habits.id, habit.id));
    const logCheck = await db.select().from(habitLogs).where(eq(habitLogs.id, log.id));
    const bucketCheck = await db.select().from(buckets).where(eq(buckets.id, bucket.id));
    
    expect(habitCheck.length).toBe(1);
    expect(logCheck.length).toBe(1);
    expect(bucketCheck.length).toBe(1);

    // 3. Delete the user
    await db.delete(users).where(eq(users.id, user.id));

    // 4. Verify everything is gone
    const habitAfter = await db.select().from(habits).where(eq(habits.id, habit.id));
    const logAfter = await db.select().from(habitLogs).where(eq(habitLogs.id, log.id));
    const bucketAfter = await db.select().from(buckets).where(eq(buckets.id, bucket.id));

    expect(habitAfter.length).toBe(0);
    expect(logAfter.length).toBe(0);
    expect(bucketAfter.length).toBe(0);
  });

  it('should delete habit logs when the parent habit is deleted (Inter-Entity Cascade)', async () => {
    // 1. Create habit and log
    const habit = await createTestHabit(user.id, 'Habit to Delete');
    const log = await createTestHabitLog(user.id, habit.id, '2026-05-09');

    // 2. Delete the habit
    await db.delete(habits).where(eq(habits.id, habit.id));

    // 3. Verify log is gone but user remains
    const logAfter = await db.select().from(habitLogs).where(eq(habitLogs.id, log.id));
    const userAfter = await db.select().from(users).where(eq(users.id, user.id));

    expect(logAfter.length).toBe(0);
    expect(userAfter.length).toBe(1);
  });
});
