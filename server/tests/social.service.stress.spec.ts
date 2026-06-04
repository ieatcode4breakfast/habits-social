import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createFriendship, shareHabitWithUser, User, Habit, Friendship, db } from './test.utils';
import { SocialService } from '../services/social.service';
import { eq } from 'drizzle-orm';
import { friendships as friendshipsTable, habits, habitLogs } from '../db/schema';

describe('SocialService - Stress Testing', () => {
  let userA: User;
  let userB: User;
  let habitH: Habit;
  let friendship: Friendship;

  beforeAll(async () => {
    userA = await createTestUser(`soc_A_${Date.now()}`, `soc_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`soc_B_${Date.now()}`, `soc_B_${Date.now()}@ex.com`);
    
    // User A and User B are friends
    friendship = await createFriendship(userA.id, userB.id, 'accepted');

    // User A creates Habit H and shares with User B
    habitH = await createTestHabit(userA.id, 'Shared Habit H');
    await shareHabitWithUser(habitH.id, userB.id);

    // Create a log for Habit H by User A, shared with B
    await db.insert(habitLogs).values({
      id: `${habitH.id}_2024-01-01`,
      habitId: habitH.id,
      ownerId: userA.id,
      date: '2024-01-01',
      status: 'completed',
      sharedWith: [userB.id],
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    if (habitH?.id) await deleteTestHabit(habitH.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should cascade friendship removal properly across habits and logs', async () => {
    // Action: remove friendship
    const result = await SocialService.removeFriendship(db, userA.id, friendship.id, null);
    expect(result).toBe(true);

    // Assertions:
    // 1. User B's ID is removed from the sharedWith array on Habit H
    const hRes = await db.select().from(habits).where(eq(habits.id, habitH.id));
    expect(hRes[0]?.sharedWith).not.toContain(userB.id);

    // 2. User B's ID is removed from log-level sharing too
    const logRes = await db.select().from(habitLogs).where(eq(habitLogs.id, `${habitH.id}_2024-01-01`));
    expect(logRes[0]?.sharedWith).not.toContain(userB.id);

    // 3. Friendship row is deleted after cleanup succeeds
    const friendshipRes = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, friendship.id));
    expect(friendshipRes).toHaveLength(0);
  }, 60000);
});
