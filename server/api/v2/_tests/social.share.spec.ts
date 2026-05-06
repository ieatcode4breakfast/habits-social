import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';

describe('POST /api/v2/social/share-habits', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let habitA: any;
  let friendshipId: string | null = null;

  beforeAll(async () => {
    handler = (await import('../social/share-habits.post')).default;
    userA = await createTestUser(`sh_a_${Date.now()}`, `sh_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`sh_b_${Date.now()}`, `sh_b_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Shareable Habit');
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should block sharing a habit with a non-friend (PRR-3)', async () => {
    const event = createMockEvent(userA.id, {
      targetUserId: userB.id,
      habitIds: [habitA.id]
    }, {}, {}, {}, 'POST');

    await expect(handler(event)).rejects.toThrow(/You can only share habits with friends/i);
  });

  it('should allow sharing once an accepted friendship exists', async () => {
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;

    const event = createMockEvent(userA.id, {
      targetUserId: userB.id,
      habitIds: [habitA.id]
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    expect(response.data.success).toBe(true);
  });
});
