import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';

describe('GET /api/social/feed', () => {
  let handler: any;
  let userA: any; // User creating logs
  let userB: any; // User viewing feed
  let habitA: any;
  let friendshipId: string | null = null;
  let habitLogHandler: any;

  beforeAll(async () => {
    handler = (await import('../api/social/feed.get')).default;
    habitLogHandler = (await import('../api/habitlogs/index')).default;
    userA = await createTestUser(`fd_a_${Date.now()}`, `fd_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`fd_b_${Date.now()}`, `fd_b_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Feed Habit');

    // Make them friends and share the habit
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;

    const shareHandler = (await import('../api/social/share-habits.post')).default;
    const shareEvent = createMockEvent(userA.id, { targetUserId: userB.id, habitIds: [habitA.id] }, {}, {}, {}, 'POST');
    await shareHandler(shareEvent);
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should return logs from an accepted friend', async () => {
    // User A logs a habit
    const dateStr = new Date().toISOString().split('T')[0];
    const logEvent = createMockEvent(userA.id, {
      id: `test_flog_${Date.now()}`,
      habitId: habitA.id,
      date: dateStr,
      status: 'completed'
    }, {}, {}, {}, 'POST');
    await habitLogHandler(logEvent);

    // User B fetches feed
    const feedEvent = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(feedEvent)) as any;

    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
    
    // B should see A's log
    const foundLog = response.data.find((item: any) => item.type === 'log' && item.data.habit_id === habitA.id);
    expect(foundLog).toBeDefined();
    expect(foundLog.data.owner_id).toBe(userA.id);
  });
});
