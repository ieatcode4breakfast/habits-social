import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';
import { useDB } from '../utils/db';
import { habits as habitsTable, friendships as friendshipsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Habit Creation Friendship Guard (POST)', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let createdHabitId: string | null = null;
  let friendshipId: string | null = null;

  beforeAll(async () => {
    handler = (await import('../api/habits/index')).default;
    userA = await createTestUser(`h_post_sh_a_${Date.now()}`, `h_post_sh_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`h_post_sh_b_${Date.now()}`, `h_post_sh_b_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (createdHabitId) await deleteTestHabit(createdHabitId);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should filter out users when NO friendship exists at all during creation', async () => {
    // User A and User B have NO friendship record.
    const event = createMockEvent(userA.id, { 
      title: 'Post Guard Test',
      sharedWith: [userB.id] 
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    createdHabitId = response.data.id;
    
    // CURRENTLY EXPECTED TO FAIL (it will contain userB.id until we fix it)
    expect(response.data.sharedWith || []).not.toContain(userB.id);
  });

  it('should allow sharing with PENDING friends during creation', async () => {
    // Create a PENDING friendship
    const fs = await createFriendship(userA.id, userB.id, 'pending');
    friendshipId = fs!.id;

    const event = createMockEvent(userA.id, { 
      title: 'Post Guard Pending Test',
      sharedWith: [userB.id] 
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    if (response.data.id) await deleteTestHabit(response.data.id);
    
    expect(response.data.sharedWith).toContain(userB.id);
  });

  it('should allow sharing with ACCEPTED friends during creation', async () => {
    // Update friendship to accepted
    const db = useDB();
    await db.update(friendshipsTable).set({ status: 'accepted' }).where(eq(friendshipsTable.id, friendshipId!));

    const event = createMockEvent(userA.id, { 
      title: 'Post Guard Accepted Test',
      sharedWith: [userB.id] 
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    if (response.data.id) await deleteTestHabit(response.data.id);
    
    expect(response.data.sharedWith).toContain(userB.id);
  });
});
