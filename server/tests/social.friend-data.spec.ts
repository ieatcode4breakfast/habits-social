import './setup';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { and, eq, or } from 'drizzle-orm';
import { 
  createTestUser, 
  deleteTestUser, 
  createMockEvent, 
  createTestHabit, 
  deleteTestHabit, 
  createFriendship, 
  deleteFriendship,
  shareHabitWithUser,
  db
} from './test.utils';
import { userBlocks } from '../db/schema';

describe('GET /api/social/friend-data Permutations', () => {
  let handler: any;
  let logHandler: any;
  let userA: any; // The viewer
  let userB: any; // The owner
  let sharedHabit: any;
  let privateHabit: any;
  let currentFriendshipId: string | null = null;

  beforeAll(async () => {
    handler = (await import('../api/social/friend-data.get')).default;
    logHandler = (await import('../api/habitlogs/index')).default;
    
    // Create users
    userA = await createTestUser(`viewer_${Date.now()}`, `viewer_${Date.now()}@ex.com`);
    userB = await createTestUser(`owner_${Date.now()}`, `owner_${Date.now()}@ex.com`);
    
    // Create habits for User B
    sharedHabit = await createTestHabit(userB.id, 'Shared Habit');
    privateHabit = await createTestHabit(userB.id, 'Private Habit');
    
    // Explicitly share one habit with User A
    await shareHabitWithUser(sharedHabit.id, userA.id);

    // Create logs for both habits
    const dateStr = new Date().toISOString().split('T')[0];
    
    await logHandler(createMockEvent(userB.id, {
      id: `log_shared_${Date.now()}`,
      habitId: sharedHabit.id,
      date: dateStr,
      status: 'completed'
    }, {}, {}, {}, 'POST'));

    await logHandler(createMockEvent(userB.id, {
      id: `log_private_${Date.now()}`,
      habitId: privateHabit.id,
      date: dateStr,
      status: 'completed'
    }, {}, {}, {}, 'POST'));
  }, 30000);

  afterAll(async () => {
    if (sharedHabit?.id) await deleteTestHabit(sharedHabit.id);
    if (privateHabit?.id) await deleteTestHabit(privateHabit.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  afterEach(async () => {
    if (currentFriendshipId) {
      await deleteFriendship(currentFriendshipId);
      currentFriendshipId = null;
    }
    await db.delete(userBlocks).where(or(
      and(eq(userBlocks.blockerId, userA.id), eq(userBlocks.blockedId, userB.id)),
      and(eq(userBlocks.blockerId, userB.id), eq(userBlocks.blockedId, userA.id))
    ));
  });

  describe('Relationship: Accepted Friends', () => {
    it('should return ONLY shared habits and their corresponding logs when friends', async () => {
      const fs = await createFriendship(userA.id, userB.id, 'accepted');
      currentFriendshipId = fs!.id;

      const event = createMockEvent(userA.id, {}, {}, {}, { friendId: userB.id });
      const response = await handler(event);

      // Verify Habit Isolation
      expect(response.data.habits).toHaveLength(1);
      expect(response.data.habits[0].id).toBe(sharedHabit.id);
      
      // Verify Log Isolation
      expect(response.data.logs).toBeDefined();
      const hasSharedLog = response.data.logs.some((l: any) => String(l.habitId) === String(sharedHabit.id));
      const hasPrivateLog = response.data.logs.some((l: any) => String(l.habitId) === String(privateHabit.id));
      
      expect(hasSharedLog).toBe(true);
      expect(hasPrivateLog).toBe(false);
    });

    it('should return empty data when a stale accepted friendship has a block', async () => {
      const fs = await createFriendship(userA.id, userB.id, 'accepted');
      currentFriendshipId = fs!.id;
      await db.insert(userBlocks).values({
        blockerId: userB.id,
        blockedId: userA.id,
        createdAt: new Date()
      });

      const event = createMockEvent(userA.id, {}, {}, {}, { friendId: userB.id });
      const response = await handler(event);

      expect(response.data.habits).toEqual([]);
      expect(response.data.logs).toEqual([]);
    });
  });

  describe('Relationship: Strangers (No Friendship)', () => {
    it('should return empty lists for users with no relationship', async () => {
      const event = createMockEvent(userA.id, {}, {}, {}, { friendId: userB.id });
      const response = await handler(event);
      
      expect(response.data.habits).toEqual([]);
      expect(response.data.logs).toEqual([]);
    });
  });

  describe('Relationship: Pending Requests', () => {
    it('should return empty lists for outgoing requests', async () => {
      const fs = await createFriendship(userA.id, userB.id, 'pending');
      currentFriendshipId = fs!.id;

      const event = createMockEvent(userA.id, {}, {}, {}, { friendId: userB.id });
      const response = await handler(event);
      
      expect(response.data.habits).toHaveLength(0);
      expect(response.data.logs).toHaveLength(0);
    });

    it('should return empty lists for incoming requests', async () => {
      const fs = await createFriendship(userB.id, userA.id, 'pending');
      currentFriendshipId = fs!.id;

      const event = createMockEvent(userA.id, {}, {}, {}, { friendId: userB.id });
      const response = await handler(event);
      
      expect(response.data.habits).toHaveLength(0);
      expect(response.data.logs).toHaveLength(0);
    });
  });

  describe('Input Validation', () => {
    it('should return 400 if friendId is missing', async () => {
      const event = createMockEvent(userA.id, {}, {}, {}, {});
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringMatching(/friendId is required/i)
      });
    });

    it('should return 400 for invalid date formats even for strangers', async () => {
      const event = createMockEvent(userA.id, {}, {}, {}, { 
        friendId: userB.id,
        startDate: 'not-a-date' 
      });
      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringMatching(/Invalid startDate format/i)
      });
    });
  });

  describe('Security: Self-View Consistency', () => {
    it('should show empty data when viewing self via friend-data endpoint (no self-friendship)', async () => {
      const event = createMockEvent(userB.id, {}, {}, {}, { friendId: userB.id });
      
      // Verified fix: Should resolve to an empty dataset, not throw or crash on .data
      const response = await handler(event);
      
      expect(response.data).toBeDefined();
      expect(response.data.habits).toHaveLength(0);
      expect(response.data.logs).toHaveLength(0);
    });
  });
});
