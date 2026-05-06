import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';

describe('API /api/v2/habits/[id]', () => {
  let handler: any;
  let testUser: any;
  let testHabit: any;

  beforeAll(async () => {
    handler = (await import('../habits/[id]')).default;
    testUser = await createTestUser(`h_crud_${Date.now()}`, `h_crud_${Date.now()}@ex.com`);
    testHabit = await createTestHabit(testUser.id, 'Initial Habit');
  });

  afterAll(async () => {
    if (testHabit?.id) await deleteTestHabit(testHabit.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should get a specific habit', async () => {
    const event = createMockEvent(testUser.id, {}, {}, { id: testHabit.id }, {}, 'GET');
    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testHabit.id);
    expect(response.data.title).toBe('Initial Habit');
  });

  it('should update a habit', async () => {
    const event = createMockEvent(testUser.id, { title: 'Updated Habit', color: '#ffffff' }, {}, { id: testHabit.id }, {}, 'PUT');
    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.title).toBe('Updated Habit');
  });

  it('should safely delete a habit', async () => {
    const newHabit = await createTestHabit(testUser.id, 'To Delete');
    const event = createMockEvent(testUser.id, {}, {}, { id: newHabit.id }, {}, 'DELETE');
    const response = (await handler(event)) as any;
    expect(response.data.success).toBe(true);
  });
});
