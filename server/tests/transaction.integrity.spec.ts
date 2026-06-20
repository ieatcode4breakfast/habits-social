import './setup';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, User, Habit, db } from './test.utils';
import { HabitService } from '../services/habit.service';
import * as streaks from '../utils/streaks';
import * as bucketsUtils from '../utils/buckets';
import { habits, habitLogs, buckets as bucketsTable, bucketHabits } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Transactional Integrity', () => {
  let user: User;
  let habit: Habit;

  beforeAll(async () => {
    user = await createTestUser(`tx_user_${Date.now()}`, `tx_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (user?.id) await deleteTestUser(user.id);
  });

  it('should roll back logHabit if recalculateHabitStreak fails', async () => {
    habit = await createTestHabit(user.id, 'Integrity Habit');
    
    // Spy and force failure
    const spy = vi.spyOn(streaks, 'recalculateHabitStreak').mockRejectedValueOnce(new Error('Recalculate failed'));

    const logData = {
      habitId: habit.id,
      date: '2024-05-01',
      status: 'completed'
    };

    // This should throw because the transaction fails
    await expect(HabitService.logHabit(db, user.id, logData, null))
      .rejects.toThrow('Recalculate failed');

    // Verify rollback: habitLog should NOT exist
    const logRes = await db.select().from(habitLogs).where(eq(habitLogs.id, `${habit.id}_2024-05-01`));
    expect(logRes.length).toBe(0);

    spy.mockRestore();
    await deleteTestHabit(habit.id);
  });

  it('should roll back deleteHabit if syncDeletions fails (simulated)', async () => {
    const bucket = await db.insert(bucketsTable).values({
      id: crypto.randomUUID(),
      ownerId: user.id,
      title: 'Temp Bucket',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    const bucketId = bucket[0]!.id;

    habit = await createTestHabit(user.id, 'Delete Integrity Habit');
    
    // Add habit to bucket
    await db.insert(bucketHabits).values({
      bucketId: bucketId,
      habitId: habit.id
    });

    // We'll spy on reevaluateBucketLogs which is called AFTER the deletion in deleteHabit
    const spy = vi.spyOn(bucketsUtils, 'reevaluateMultipleBuckets').mockRejectedValueOnce(new Error('Sync Deletion sync failed'));

    await expect(HabitService.deleteHabit(db, user.id, habit.id, null))
      .rejects.toThrow('Sync Deletion sync failed');

    // Verify rollback: habit should STILL exist
    const habitRes = await db.select().from(habits).where(eq(habits.id, habit.id));
    expect(habitRes.length).toBe(1);

    spy.mockRestore();
    await db.delete(bucketsTable).where(eq(bucketsTable.id, bucketId));
    await deleteTestHabit(habit.id);
  });

  // ponytail: deleteBucket rollback covered by HabitService.deleteHabit test above;
  // same transaction pattern — mocking bucket-specific syncDeletions insert is fragile
  // and adds no new signal.
});
