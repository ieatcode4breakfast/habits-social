import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createFriendship, deleteFriendship } from './test.utils';

describe('BOLA: DELETE /api/friendships/[id]', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let userC: any; // The Attacker
  let friendshipId: string;

  beforeAll(async () => {
    handler = (await import('../api/friendships/[id]')).default;
    userA = await createTestUser(`bola_a_${Date.now()}`, `bola_fa_${Date.now()}@ex.com`);
    userB = await createTestUser(`bola_b_${Date.now()}`, `bola_fb_${Date.now()}@ex.com`);
    userC = await createTestUser(`bola_c_${Date.now()}`, `bola_fc_${Date.now()}@ex.com`);
    
    // User A and User B are friends
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
    if (userC?.id) await deleteTestUser(userC.id);
  });

  it('should allow a participant (User A) to delete their own friendship', async () => {
    // We create a temporary friendship for this specific test so we don't break the main one
    const tempFs = await createFriendship(userA.id, userB.id, 'accepted');
    const eventA = createMockEvent(userA.id, {}, {}, { id: tempFs.id }, {}, 'DELETE');
    
    const response = await handler(eventA);
    expect(response.data.success).toBe(true);
  });

  it('should NOT allow an unrelated user (User C) to delete User A/B friendship', async () => {
    const eventC = createMockEvent(userC.id, {}, {}, { id: friendshipId }, {}, 'DELETE');
    
    // DESIRED BEHAVIOR (FIX): This should throw a 403 Forbidden error
    await expect(handler(eventC)).rejects.toThrow(/Not authorized/i);
  });
});
