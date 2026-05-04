import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';

describe('GET /api/v2/habits', () => {
  let handler: any;
  let testUser: any;
  let testHabit: any;

  beforeAll(async () => {
    handler = (await import('../habits/index')).default;
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
});

describe('POST /api/v2/habits', () => {
  let handler: any;
  let testUser: any;
  let createdHabitId: string;

  beforeAll(async () => {
    handler = (await import('../habits/index')).default;
    testUser = await createTestUser(`habit_p_${Date.now() % 1000000}`, `habit_p_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (createdHabitId) await deleteTestHabit(createdHabitId);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should create a new habit', async () => {
    const event = createMockEvent(testUser.id, { title: 'New Habit' }, {}, {}, {}, 'POST');
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.title).toBe('New Habit');
    createdHabitId = response.data.id;
  });
});
