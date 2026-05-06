import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';

describe('GET /api/v2/social/habit-details', () => {
  let handler: any;
  let testUser: any;
  let targetUser: any;
  let habit: any;

  beforeAll(async () => {
    handler = (await import('../social/habit-details.get')).default;
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
});
