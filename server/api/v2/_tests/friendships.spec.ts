import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createFriendship, deleteFriendship } from './test.utils';

describe('PUT /api/v2/friendships/[id]', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let friendshipId: string;

  beforeAll(async () => {
    handler = (await import('../friendships/[id]')).default;
    userA = await createTestUser(`friend_a_${Date.now()}`, `fa_${Date.now()}@ex.com`);
    userB = await createTestUser(`friend_b_${Date.now()}`, `fb_${Date.now()}@ex.com`);
    
    // User A requests User B
    const fs = await createFriendship(userA.id, userB.id, 'pending');
    friendshipId = fs!.id;
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should reject accepting your own initiated friend request (PRR-8)', async () => {
    // User A tries to accept the request they initiated
    const eventA = createMockEvent(userA.id, { status: 'accepted' }, {}, { id: friendshipId }, {}, 'PUT');
    await expect(handler(eventA)).rejects.toThrow(/Friendship not found/i);
  });
});
