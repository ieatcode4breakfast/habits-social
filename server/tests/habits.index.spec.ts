import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';

describe('GET /api/habits', () => {
  let handler: any;
  let testUser: any;
  let testHabit: any;

  beforeAll(async () => {
    handler = (await import('../api/habits/index')).default;
    testUser = await createTestUser(`habit_u_${Date.now() % 1000000}`, `habit_${Date.now()}@ex.com`);
    testHabit = await createTestHabit(testUser.id, 'Test Habit');
  });

  afterAll(async () => {
    if (testHabit?.id) await deleteTestHabit(testHabit.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should return habits for the authenticated user', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, {}, 'GET');
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThanOrEqual(1);
    expect(response.data.find((h: any) => h.id === testHabit.id)).toBeDefined();
  });

  it('should safely reject invalid lastSynced strings (PRR-7)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: 'not-a-number' }, 'GET');
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/Invalid lastSynced/i);
  });

  it('should safely handle NaN lastSynced (PRR-7)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: 'NaN' }, 'GET');
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/Invalid lastSynced/i);
  });
});

describe('POST /api/habits', () => {
  let handler: any;
  let testUser: any;
  const createdHabitIds: string[] = [];

  beforeAll(async () => {
    handler = (await import('../api/habits/index')).default;
    testUser = await createTestUser(`habit_p_${Date.now() % 1000000}`, `habit_p_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    for (const habitId of createdHabitIds) {
      await deleteTestHabit(habitId);
    }
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should create a new habit', async () => {
    const event = createMockEvent(testUser.id, { title: 'New Habit' }, {}, {}, {}, 'POST');
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.title).toBe('New Habit');
    expect(response.data.skipsPeriod).toBe('weekly');
    expect(response.data.skipsCount).toBe(2);
    createdHabitIds.push(response.data.id);
  });

  it('should save no skips allowed as disabled with zero skips', async () => {
    const event = createMockEvent(testUser.id, {
      title: 'No Skip Habit',
      skipsPeriod: 'disabled',
      skipsCount: 5
    }, {}, {}, {}, 'POST');
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data.skipsPeriod).toBe('disabled');
    expect(response.data.skipsCount).toBe(0);
    createdHabitIds.push(response.data.id);
  });

  it('should normalize weekly and monthly skip counts to their minimums', async () => {
    const weeklyEvent = createMockEvent(testUser.id, {
      title: 'Weekly Minimum Habit',
      skipsPeriod: 'weekly',
      skipsCount: 0
    }, {}, {}, {}, 'POST');
    weeklyEvent.context.userId = testUser.id;

    const weeklyResponse = (await handler(weeklyEvent)) as any;
    expect(weeklyResponse.data.skipsCount).toBe(1);
    createdHabitIds.push(weeklyResponse.data.id);

    const monthlyEvent = createMockEvent(testUser.id, {
      title: 'Monthly Minimum Habit',
      skipsPeriod: 'monthly',
      skipsCount: 0
    }, {}, {}, {}, 'POST');
    monthlyEvent.context.userId = testUser.id;

    const monthlyResponse = (await handler(monthlyEvent)) as any;
    expect(monthlyResponse.data.skipsCount).toBe(1);
    createdHabitIds.push(monthlyResponse.data.id);
  });
});
