import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format } from 'date-fns';
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
    const dateStr = format(new Date(), 'yyyy-MM-dd');
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
    const foundLog = response.data.find((item: any) => 
      (item.type === 'INITIAL_COMPLETION' || item.type === 'STREAK_STARTED') && 
      item.habit.id === habitA.id
    );
    expect(foundLog).toBeDefined();
    expect(foundLog.user.id).toBe(userA.id);
    expect('sharedWith' in foundLog.habit).toBe(false);
    
    // Data Contract Validation for 7-day visualizer
    expect(foundLog.weeklyStatus).toBeDefined();
    expect(Array.isArray(foundLog.weeklyStatus)).toBe(true);
    expect(foundLog.weeklyStatus.length).toBe(7);
    expect(foundLog.weeklyStatus[6].date).toBe(dateStr);
  });

  it('should handle pagination cursors without database errors', async () => {
    const feedEvent = createMockEvent(userB.id, {}, {}, {}, {
      cursorDate: '2026-05-17',
      cursorTimestamp: '2026-05-17T00:02:01.999908+00:00',
      cursorId: 'mock-id'
    }, 'GET');
    const response = (await handler(feedEvent)) as any;

    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should not leak stack trace on database error', async () => {
    const invalidEvent = createMockEvent(userB.id, {}, {}, {}, {
      cursorDate: '2026-05-17',
      cursorTimestamp: 'invalid-timestamp', // Triggers DB cast error
      cursorId: 'mock-id'
    }, 'GET');

    try {
      await handler(invalidEvent);
      // If it didn't throw, fail the test
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.statusCode).toBe(500);
      // Verify that the error does not leak internal details
      if (err.data) {
        expect(err.data.stack).toBeUndefined();
        expect(err.data.message).toBeUndefined();
      }
    }
  });
});
