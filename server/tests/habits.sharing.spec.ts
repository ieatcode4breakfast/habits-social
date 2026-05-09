import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';
import { useDB } from '../utils/db';
import { habits as habitsTable, friendships as friendshipsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Habit Sharing Friendship Guard', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let habitA: any;
  let friendshipId: string | null = null;

  beforeAll(async () => {
    handler = (await import('../api/habits/[id]')).default;
    userA = await createTestUser(`h_sh_a_${Date.now()}`, `h_sh_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`h_sh_b_${Date.now()}`, `h_sh_b_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Guard Test Habit');
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should filter out users when NO friendship exists at all', async () => {
    // User A and User B have NO friendship record.
    const event = createMockEvent(userA.id, { 
      sharedWith: [userB.id] 
    }, {}, { id: habitA.id }, {}, 'PUT');

    const response = (await handler(event)) as any;
    
    expect(response.data.sharedWith || []).not.toContain(userB.id);
  });

  it('should allow sharing with PENDING friends', async () => {
    // Create a PENDING friendship
    const fs = await createFriendship(userA.id, userB.id, 'pending');
    friendshipId = fs!.id;

    const event = createMockEvent(userA.id, { 
      sharedWith: [userB.id] 
    }, {}, { id: habitA.id }, {}, 'PUT');

    const response = (await handler(event)) as any;
    
    expect(response.data.sharedWith).toContain(userB.id);
  });

  it('should allow sharing with ACCEPTED friends', async () => {
    // Update friendship to accepted
    const db = useDB();
    await db.update(friendshipsTable).set({ status: 'accepted' }).where(eq(friendshipsTable.id, friendshipId!));

    const event = createMockEvent(userA.id, { 
      sharedWith: [userB.id] 
    }, {}, { id: habitA.id }, {}, 'PUT');

    const response = (await handler(event)) as any;
    
    expect(response.data.sharedWith).toContain(userB.id);
  });

  it('should allow removing a friend from sharedWith array', async () => {
    const event = createMockEvent(userA.id, { 
      sharedWith: [] 
    }, {}, { id: habitA.id }, {}, 'PUT');

    const response = (await handler(event)) as any;
    
    expect(response.data.sharedWith || []).toHaveLength(0);
    
    // Double check DB
    const db = useDB();
    const [dbHabit] = await db.select().from(habitsTable).where(eq(habitsTable.id, habitA.id));
    expect(dbHabit).toBeDefined();
    expect(dbHabit!.sharedWith || []).toHaveLength(0);
  });
});
