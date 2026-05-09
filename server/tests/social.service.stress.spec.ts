import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket, createFriendship, shareHabitWithUser, User, Habit, Bucket, Friendship, db } from './test.utils';
import { SocialService } from '../services/social.service';
import { eq, and } from 'drizzle-orm';
import { bucketHabits, habits, habitLogs } from '../db/schema';

describe('SocialService - Stress Testing', () => {
  let userA: User;
  let userB: User;
  let habitH: Habit;
  let bucketBK: Bucket;
  let friendship: Friendship;

  beforeAll(async () => {
    userA = await createTestUser(`soc_A_${Date.now()}`, `soc_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`soc_B_${Date.now()}`, `soc_B_${Date.now()}@ex.com`);
    
    // User A and User B are friends
    friendship = await createFriendship(userA.id, userB.id, 'accepted');

    // User A creates Habit H and shares with User B
    habitH = await createTestHabit(userA.id, 'Shared Habit H');
    await shareHabitWithUser(habitH.id, userB.id);

    // User B creates Bucket BK and adds Habit H to it
    bucketBK = await createTestBucket(userB.id, 'Bucket BK');
    await db.insert(bucketHabits).values({
      bucketId: bucketBK.id,
      habitId: habitH.id,
      addedBy: userB.id,
      approvalStatus: 'accepted'
    });

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
    if (bucketBK?.id) await deleteTestBucket(bucketBK.id);
    if (habitH?.id) await deleteTestHabit(habitH.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should cascade friendship removal properly across habits and buckets', async () => {
    // Action: remove friendship
    const result = await SocialService.removeFriendship(db, userA.id, friendship.id, null);
    expect(result).toBe(true);

    // Assertions:
    // 1. Habit H is removed from User B's bucket
    const bhRes = await db.select().from(bucketHabits).where(and(eq(bucketHabits.bucketId, bucketBK.id), eq(bucketHabits.habitId, habitH.id)));
    expect(bhRes[0]?.approvalStatus).toBe('removed');

    // 2. User B's ID is removed from the sharedWith array on Habit H
    const hRes = await db.select().from(habits).where(eq(habits.id, habitH.id));
    expect(hRes[0]?.sharedWith).not.toContain(userB.id);

    // 3. User B's ID is removed from the sharedWith array on all its historical logs
    const hlRes = await db.select().from(habitLogs).where(eq(habitLogs.id, `${habitH.id}_2024-01-01`));
    expect(hlRes[0]?.sharedWith).not.toContain(userB.id);
  }, 60000);
});
