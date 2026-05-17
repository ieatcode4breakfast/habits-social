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

describe('DELETE /api/friendships/[id]', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let userC: any;
  let friendshipId: string;

  beforeAll(async () => {
    handler = (await import('../api/friendships/[id]')).default;
    userA = await createTestUser(`del_a_${Date.now()}`, `da_${Date.now()}@ex.com`);
    userB = await createTestUser(`del_b_${Date.now()}`, `db_${Date.now()}@ex.com`);
    userC = await createTestUser(`del_c_${Date.now()}`, `dc_${Date.now()}@ex.com`);
    
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
    if (userC?.id) await deleteTestUser(userC.id);
  });

  it('should reject deleting a friendship by a third party (unauthorized)', async () => {
    const event = createMockEvent(userC.id, {}, {}, { id: friendshipId }, {}, 'DELETE');
    await expect(handler(event)).rejects.toThrow(/Forbidden/i);
  });

  it('should allow deleting a friendship by the initiator', async () => {
    const event = createMockEvent(userA.id, {}, {}, { id: friendshipId }, {}, 'DELETE');
    const response = await handler(event);
    expect(response.data.success).toBe(true);
  });

  it('should allow deleting a friendship by the receiver', async () => {
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    const newFriendshipId = fs!.id;

    const event = createMockEvent(userB.id, {}, {}, { id: newFriendshipId }, {}, 'DELETE');
    const response = await handler(event);
    expect(response.data.success).toBe(true);
  });
});
