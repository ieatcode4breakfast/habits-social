import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createFriendship, User, Habit, db } from './test.utils';
import { HabitService } from '../services/habit.service';
import { eq } from 'drizzle-orm';
import { shareEvents, habits, habitLogs } from '../db/schema';

describe('HabitService - Stress Testing', () => {
  let userA: User;
  let userB: User;
  let userC: User;
  let habitA: Habit;

  beforeAll(async () => {
    userA = await createTestUser(`hab_A_${Date.now()}`, `hab_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`hab_B_${Date.now()}`, `hab_B_${Date.now()}@ex.com`);
    userC = await createTestUser(`hab_C_${Date.now()}`, `hab_C_${Date.now()}@ex.com`);

    // Establish friendships so the "Friendship Guard" allows sharing
    await createFriendship(userA.id, userB.id, 'accepted');
    await createFriendship(userA.id, userC.id, 'accepted');
    
    habitA = await createTestHabit(userA.id, 'Habit A');
    
    // Initial state: shared with B
    await db.update(habits).set({ sharedWith: [userB.id], userDate: '2024-01-01' }).where(eq(habits.id, habitA.id));
    habitA.sharedWith = [userB.id];
    habitA.userDate = '2024-01-01';

  });

  afterAll(async () => {
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
    if (userC?.id) await deleteTestUser(userC.id);
  });

  it('should generate share events when sharing delta changes', async () => {
    // Action: Update habit to remove B and add C
    const updateData = { sharedWith: [userC.id] };
    await HabitService.updateHabit(db, userA.id, habitA.id, updateData, habitA, null);

    // Assertions:
    // 1. shareEvents created for userC
    const seRes = await db.select().from(shareEvents).where(eq(shareEvents.recipientId, userC.id));
    expect(seRes.length).toBe(1);
    expect(seRes[0]?.habitIds).toContain(habitA.id);
  });

  it('should cascade streak recalculations on log deletion', async () => {
    // Setup a 3-day streak
    const logs = [
      { id: `${habitA.id}_2024-02-01`, habitId: habitA.id, ownerId: userA.id, date: '2024-02-01', status: 'completed' as const, streakCount: 1, brokenStreakCount: 0, updatedAt: new Date() },
      { id: `${habitA.id}_2024-02-02`, habitId: habitA.id, ownerId: userA.id, date: '2024-02-02', status: 'completed' as const, streakCount: 2, brokenStreakCount: 0, updatedAt: new Date() },
      { id: `${habitA.id}_2024-02-03`, habitId: habitA.id, ownerId: userA.id, date: '2024-02-03', status: 'completed' as const, streakCount: 3, brokenStreakCount: 0, updatedAt: new Date() }
    ];
    await db.insert(habitLogs).values(logs);
    await db.update(habits).set({ currentStreak: 3, longestStreak: 3 }).where(eq(habits.id, habitA.id));

    // Action: Delete day 2
    await HabitService.deleteHabitLog(db, userA.id, habitA.id, '2024-02-02', null);

    // Assertion:
    // Day 1: 1
    // Day 2: deleted (gap)
    // Day 3: should reset to 1
    const hRes = await db.select().from(habits).where(eq(habits.id, habitA.id));
    expect(hRes[0]?.currentStreak).toBe(1);
    expect(hRes[0]?.longestStreak).toBe(1); // Longest could theoretically be 1 now since Day 1 and Day 3 are isolated 1-day streaks
  }, 60000);
});
