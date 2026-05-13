import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestHabitLog, db } from './test.utils';
import { recalculateHabitStreak } from '../utils/streaks';
import { habitLogs, habits } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { subDays, formatISO } from 'date-fns';

describe('Gap Detection with Cleared Logs (Final Boss)', () => {
  let user: any;
  let habit: any;

  beforeAll(async () => {
    user = await createTestUser(`final_${Date.now()}`, `final_${Date.now()}@ex.com`);
    habit = await createTestHabit(user.id, 'Final Boss Test');
  });

  afterAll(async () => {
    if (user?.id) {
      await db.delete(habitLogs).where(eq(habitLogs.ownerId, user.id));
      await deleteTestHabit(habit.id);
      await deleteTestUser(user.id);
    }
  });

  it('GREEN: should NOT trigger gap reset when clearing Today if Yesterday is empty', async () => {
    const today = formatISO(new Date(), { representation: 'date' });
    const monday = formatISO(subDays(new Date(), 2), { representation: 'date' }); // Mon if today is Wed

    await db.delete(habitLogs).where(eq(habitLogs.habitId, habit.id));

    // 1. Log Monday (streak 1)
    await createTestHabitLog(user.id, habit.id, monday, 'completed');
    await recalculateHabitStreak(db, habit.id, user.id);
    
    // 2. Log Today (Wednesday) and then CLEAR it
    await createTestHabitLog(user.id, habit.id, today, 'completed');
    await recalculateHabitStreak(db, habit.id, user.id, today);
    
    // Now CLEAR it
    await db.update(habitLogs)
      .set({ status: 'cleared' })
      .where(and(eq(habitLogs.habitId, habit.id), eq(habitLogs.date, today)));
    
    await recalculateHabitStreak(db, habit.id, user.id, today);
    
    const h = await db.query.habits.findFirst({ where: eq(habits.id, habit.id) });
    
    // EXPECTED: Streak remains 1 (reverted from 2, but NOT reset to 0 by gap)
    expect(h?.currentStreak).toBe(1);
    expect(h?.streakAnchorDate).toBe(monday);
  });
});
