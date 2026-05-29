import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { habits as habitsTable } from '../db/schema';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, shareHabitWithUser, db } from './test.utils';

describe('GET /api/social/habit-details', () => {
  let handler: any;
  let testUser: any;
  let targetUser: any;
  let habit: any;

  beforeAll(async () => {
    handler = (await import('../api/social/habit-details.get')).default;
    testUser = await createTestUser(`sd_viewer_${Date.now()}`, `sd_v_${Date.now()}@ex.com`);
    targetUser = await createTestUser(`sd_target_${Date.now()}`, `sd_t_${Date.now()}@ex.com`);
    habit = await createTestHabit(targetUser.id, 'Target Habit');
  });

  afterAll(async () => {
    if (habit?.id) await deleteTestHabit(habit.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
    if (targetUser?.id) await deleteTestUser(targetUser.id);
  });

  it('should reject invalid YYYY-MM-DD date strings safely (PRR-12, PRR-22)', async () => {
    const event = createMockEvent(targetUser.id, {}, {}, {}, { 
      habitId: habit.id,
      startDate: 'not-a-date',
      endDate: '2023-12-01'
    });

    await expect(handler(event)).rejects.toThrow(/Invalid startDate format/i);
  });

  it('should safely reject NaN date inputs (PRR-22)', async () => {
    const event = createMockEvent(targetUser.id, {}, {}, {}, { 
      habitId: habit.id,
      startDate: '2023-12-01',
      endDate: 'invalid-end'
    });

    await expect(handler(event)).rejects.toThrow(/Invalid endDate format/i);
  });

  it('should allow the owner to fetch their own current habit details', async () => {
    const event = createMockEvent(targetUser.id, {}, {}, {}, { habitId: habit.id });

    const response = await handler(event);

    expect(response.data.habit.id).toBe(habit.id);
    expect(response.data.habit.ownerId).toBe(targetUser.id);
  });

  it('should allow a currently shared viewer to fetch live habit details', async () => {
    await shareHabitWithUser(habit.id, testUser.id);

    const liveTitle = `Live Target Habit ${Date.now()}`;
    await db.update(habitsTable)
      .set({ title: liveTitle, updatedAt: new Date() })
      .where(eq(habitsTable.id, habit.id));

    const event = createMockEvent(testUser.id, {}, {}, {}, { habitId: habit.id });
    const response = await handler(event);

    expect(response.data.habit.id).toBe(habit.id);
    expect(response.data.habit.title).toBe(liveTitle);
  });

  it('should reject a viewer after the habit is no longer shared with them', async () => {
    await db.update(habitsTable)
      .set({ sharedWith: [], updatedAt: new Date() })
      .where(eq(habitsTable.id, habit.id));

    const event = createMockEvent(testUser.id, {}, {}, {}, { habitId: habit.id });

    await expect(handler(event)).rejects.toThrow(/Habit not found or not shared with you/i);
  });
});
