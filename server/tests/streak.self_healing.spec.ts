import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, db } from './test.utils';
import { recalculateHabitStreak } from '../utils/streaks';
import { habitLogs, habits } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { subDays, formatISO } from 'date-fns';

describe('Zero-Trust Streak Engine: Automatic Self-Healing', () => {
  let user: any;
  let habit: any;

  beforeAll(async () => {
    user = await createTestUser(`heal_${Date.now()}`, `heal_${Date.now()}@ex.com`);
    habit = await createTestHabit(user.id, 'Self-Healing Test Habit');
  });

  afterAll(async () => {
    if (user?.id) {
      await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
      await deleteTestHabit(habit.id);
      await deleteTestUser(user.id);
    }
  });

  it('should automatically repair historical corrupted streak counts when recalculate is triggered', async () => {
    const today = formatISO(new Date(), { representation: 'date' });
    const yesterday = formatISO(subDays(new Date(), 1), { representation: 'date' });
    const dayBefore = formatISO(subDays(new Date(), 2), { representation: 'date' });

    // 1. Establish an honest 3-day history in the DB
    // Day 1: completed (streak should be 1)
    // Day 2: skipped (streak should be 1 - protected)
    // Day 3: completed (streak should be 2)

    // Inserts Day 1 & Day 3 normally
    await db.insert(habitLogs).values([
      { id: `${habit.id}_${dayBefore}`, habitId: habit.id, ownerId: user.id, date: dayBefore, status: 'completed', streakCount: 1 },
      { id: `${habit.id}_${today}`, habitId: habit.id, ownerId: user.id, date: today, status: 'completed', streakCount: 2 }
    ]);

    // 2. Simulate CORRUPTION: Insert Day 2 skipped with a corrupt '0' streak count
    // (Bypasses normal service logic to simulate offline or sync corruption)
    await db.insert(habitLogs).values({
      id: `${habit.id}_${yesterday}`,
      habitId: habit.id,
      ownerId: user.id,
      date: yesterday,
      status: 'skipped',
      streakCount: 0, // <-- CORRUPTED! Should be 1
      brokenStreakCount: 0
    });

    // 3. Trigger recalculateHabitStreak on the latest date (today)
    // In the old incremental engine, this would propagate today's streak as '1' (stale propagation).
    // In the new zero-trust engine, it must perform a full recalculation and self-heal the history.
    await recalculateHabitStreak(db, habit.id, user.id, today);

    // 4. Assertions
    // A. Check that the corrupted log has been self-healed in the database
    const healedLog = await db.query.habitLogs.findFirst({
      where: and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, yesterday))
    });
    expect(healedLog?.streakCount).toBe(1); // Self-healed back to 1!

    // B. Check that today's log has the correct streak count of 2
    const todayLog = await db.query.habitLogs.findFirst({
      where: and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, today))
    });
    expect(todayLog?.streakCount).toBe(2);

    // C. Check that the habits table is synchronized with the healed values
    const h = await db.query.habits.findFirst({ where: eq(habits.id, habit.id) });
    expect(h?.currentStreak).toBe(2);
  });
});
