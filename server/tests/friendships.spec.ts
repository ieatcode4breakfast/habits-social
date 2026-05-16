import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createFriendship, deleteFriendship } from './test.utils';

describe('PUT /api/friendships/[id]', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let friendshipId: string;

  beforeAll(async () => {
    handler = (await import('../api/friendships/[id]')).default;
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

  it('should reject accepting your own initiated friend request (PRr-8)', async () => {
    // User A tries to accept the request they initiated
    const eventA = createMockEvent(userA.id, { status: 'accepted' }, {}, { id: friendshipId }, {}, 'PUT');
    await expect(handler(eventA)).rejects.toThrow(/Friendship not found/i);
  });

  it('should reject favoriting a friendship the user is not part of', async () => {
    const favoriteHandler = (await import('../api/friendships/favorite.put')).default;
    const userC = await createTestUser(`friend_c_${Date.now()}`, `fc_${Date.now()}@ex.com`);
    const eventC = createMockEvent(userC.id, { friendshipId, favorite: true }, {}, {}, {}, 'PUT');
    
    await expect(favoriteHandler(eventC)).rejects.toThrow(/Not authorized/i);
    await deleteTestUser(userC.id);
  });
});

describe('POST /api/friendships', () => {
  it('should reject creating a friendship with yourself', async () => {
    const createHandler = (await import('../api/friendships/index')).default;
    const userC = await createTestUser(`friend_self_${Date.now()}`, `fs_${Date.now()}@ex.com`);
    const event = createMockEvent(userC.id, { targetUserId: userC.id }, {}, {}, {}, 'POST');
    
    await expect(createHandler(event)).rejects.toThrow(/You cannot friend yourself/i);
    await deleteTestUser(userC.id);
  });
});

