import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit } from './test.utils';

describe('POST /api/habits/reorder', () => {
  let handler: any;
  let testUser: any;
  let habit1: any;
  let habit2: any;

  beforeAll(async () => {
    handler = (await import('../api/habits/reorder')).default;
    testUser = await createTestUser(`h_reo_${Date.now()}`, `h_reo_${Date.now()}@ex.com`);
    habit1 = await createTestHabit(testUser.id, 'Habit 1');
    habit2 = await createTestHabit(testUser.id, 'Habit 2');
  });

  afterAll(async () => {
    if (habit1?.id) await deleteTestHabit(habit1.id);
    if (habit2?.id) await deleteTestHabit(habit2.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should reorder habits successfully', async () => {
    const event = createMockEvent(testUser.id, {
      ids: [habit1.id, habit2.id]
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    expect(response.data.success).toBe(true);

    // Verify ordering
    const getHandler = (await import('../api/habits/index')).default;
    const getEvent = createMockEvent(testUser.id, {}, {}, {}, {}, 'GET');
    getEvent.context.userId = testUser.id;
    const getResponse = (await getHandler(getEvent)) as any;
    
    const h1 = getResponse.data.find((h: any) => h.id === habit1.id);
    const h2 = getResponse.data.find((h: any) => h.id === habit2.id);
    
    expect(h1.sortOrder).toBe(0);
    expect(h2.sortOrder).toBe(1);
  });
});
