import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';
import { format, subDays, addDays } from 'date-fns';

describe('Habit Log Date Restrictions', () => {
  let handler: any;
  let user: any;
  let habit: any;

  beforeAll(async () => {
    handler = (await import('../api/habitlogs/index')).default;
    user = await createTestUser(`tester_${Date.now()}`, `tester_${Date.now()}@test.com`);
    habit = await createTestHabit(user.id, 'Test Habit');
  });

  afterAll(async () => {
    if (habit?.id) await deleteTestHabit(habit.id);
    if (user?.id) await deleteTestUser(user.id);
  });

  it('should accept a historical log (e.g., 30 days ago)', async () => {
    const historicalDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const event = createMockEvent(user.id, {
      habitId: habit.id,
      date: historicalDate,
      status: 'completed'
    }, {}, {}, {}, 'POST');

    // THIS IS THE TARGET BEHAVIOR
    // Currently, this should FAIL with 400
    const result = await handler(event);
    expect(result.data.status).toBe('completed');
  });

  it('should reject a future log (e.g., 2 days in the future)', async () => {
    const futureDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const event = createMockEvent(user.id, {
      habitId: habit.id,
      date: futureDate,
      status: 'completed'
    }, {}, {}, {}, 'POST');

    try {
      await handler(event);
      // If it doesn't throw, fail the test
      expect(true).toBe(false); 
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      // New message check
      expect(e.statusMessage).toContain('Habit updates are not allowed for future dates');
    }
  });

  it('should allow deleting a historical log', async () => {
    const historicalDate = format(subDays(new Date(), 45), 'yyyy-MM-dd');
    
    // First, insert a log into DB
    const { createTestHabitLog } = await import('./test.utils');
    await createTestHabitLog(user.id, habit.id, historicalDate, 'completed');

    const event = createMockEvent(user.id, {}, {}, {}, {
      habitId: habit.id,
      date: historicalDate
    }, 'DELETE');

    // Currently, this should FAIL with 400
    const result = await handler(event);
    expect(result.data.success).toBe(true);
  });
});
