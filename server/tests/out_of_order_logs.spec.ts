import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestHabitLog, db } from './test.utils';
import { recalculateHabitStreak } from '../utils/streaks';
import { habitLogs, habits } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { subDays, formatISO } from 'date-fns';

describe('Out of Order Logging Streak Propagation', () => {
  let user: any;
  let habit: any;

  beforeAll(async () => {
    user = await createTestUser(`ooo_${Date.now()}`, `ooo_${Date.now()}@ex.com`);
    habit = await createTestHabit(user.id, 'Out of Order Test');
  });

  afterAll(async () => {
    if (user?.id) {
      await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
      await deleteTestHabit(habit.id);
      await deleteTestUser(user.id);
    }
  });

  it('should update subsequent logs when a missing day is filled in', async () => {
    const today = formatISO(new Date(), { representation: 'date' });
    const yesterday = formatISO(subDays(new Date(), 1), { representation: 'date' });
    const dayBefore = formatISO(subDays(new Date(), 2), { representation: 'date' });

    await db.delete(habitLogs).where(eq(habitLogs.habitId, habit.id));

    // 1. Log Day Before Yesterday (Day 1)
    await createTestHabitLog(user.id, habit.id, dayBefore, 'completed');
    await recalculateHabitStreak(db, habit.id, user.id, dayBefore);
    
    // 2. Log Today (Day 3) - Leaving Yesterday (Day 2) missing
    await createTestHabitLog(user.id, habit.id, today, 'completed');
    await recalculateHabitStreak(db, habit.id, user.id, today);
    
    // Check state: Day 1 should have streak 1, Today should have streak 1 (due to gap)
    const logTodayBefore = await db.query.habitLogs.findFirst({
      where: and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, today))
    });
    console.log(`Streak on Day 3 before filling gap: ${logTodayBefore?.streakCount}`);
    
    // 3. Now fill the gap: Log Yesterday (Day 2)
    await createTestHabitLog(user.id, habit.id, yesterday, 'completed');
    await recalculateHabitStreak(db, habit.id, user.id, yesterday);
    
    // 4. Check state of Today (Day 3) again
    const logTodayAfter = await db.query.habitLogs.findFirst({
      where: and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, today))
    });
    
    console.log(`Streak on Day 3 after filling gap: ${logTodayAfter?.streakCount}`);
    
    // EXPECTED: Streak on Day 3 should be 3!
    // If the bug exists, it will likely be 1 or 0 because the update didn't propagate or used stale state.
    expect(logTodayAfter?.streakCount).toBe(3);
    
    // Also check habit table
    const h = await db.query.habits.findFirst({ where: eq(habits.id, habit.id) });
    expect(h?.currentStreak).toBe(3);
  });
});
