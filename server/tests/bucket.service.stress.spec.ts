import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket, createFriendship, shareHabitWithUser, User, Habit, Bucket, Friendship, db } from './test.utils';
import { BucketService } from '../services/bucket.service';
import { eq, and } from 'drizzle-orm';
import { bucketHabits, sharedBucketMembers } from '../db/schema';

describe('BucketService - Stress Testing', () => {
  let userA: User; // Owner
  let userB: User; // Friend
  let userC: User; // Stranger
  let habitA: Habit;
  let habitB: Habit;
  let habitC: Habit;
  let bucketA: Bucket;
  let friendshipAB: Friendship;

  beforeAll(async () => {
    userA = await createTestUser(`buck_A_${Date.now()}`, `buck_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`buck_B_${Date.now()}`, `buck_B_${Date.now()}@ex.com`);
    userC = await createTestUser(`buck_C_${Date.now()}`, `buck_C_${Date.now()}@ex.com`);
    
    friendshipAB = await createFriendship(userA.id, userB.id, 'accepted');

    habitA = await createTestHabit(userA.id, 'Habit A');
    habitB = await createTestHabit(userB.id, 'Habit B');
    habitC = await createTestHabit(userC.id, 'Habit C');

    await shareHabitWithUser(habitB.id, userA.id);
    await shareHabitWithUser(habitC.id, userA.id);

    bucketA = await createTestBucket(userA.id, 'Bucket A');
  });

  afterAll(async () => {
    if (bucketA?.id) await deleteTestBucket(bucketA.id);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (habitB?.id) await deleteTestHabit(habitB.id);
    if (habitC?.id) await deleteTestHabit(habitC.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
    if (userC?.id) await deleteTestUser(userC.id);
  });

  it('should correctly aggregate foreign habits and manage members', async () => {
    // User A updates bucket, adding Habit A, Habit B (friend), Habit C (stranger)
    const updateData = {
      habitIds: [habitA.id, habitB.id, habitC.id]
    };

    await BucketService.updateBucket(db, userA.id, bucketA.id, updateData, bucketA, null);

    // Assertions:
    const bhRes = await db.select().from(bucketHabits).where(eq(bucketHabits.bucketId, bucketA.id));
    
    // User C's habit should be filtered out
    const hasC = bhRes.some(bh => bh.habitId === habitC.id);
    expect(hasC).toBe(false);

    // User A's habit is accepted
    const aHabit = bhRes.find(bh => bh.habitId === habitA.id);
    expect(aHabit?.approvalStatus).toBe('accepted');

    // User B's habit is pending
    const bHabit = bhRes.find(bh => bh.habitId === habitB.id);
    expect(bHabit?.approvalStatus).toBe('pending');

    // User B is added to sharedBucketMembers
    const memRes = await db.select().from(sharedBucketMembers).where(and(eq(sharedBucketMembers.bucketId, bucketA.id), eq(sharedBucketMembers.userId, userB.id)));
    expect(memRes.length).toBe(1);
    expect(memRes[0]?.status).toBe('pending');

    // Action 2: Remove User B's habit
    await BucketService.updateBucket(db, userA.id, bucketA.id, { habitIds: [habitA.id] }, bucketA, null);

    // User B is removed from sharedBucketMembers
    const memRes2 = await db.select().from(sharedBucketMembers).where(and(eq(sharedBucketMembers.bucketId, bucketA.id), eq(sharedBucketMembers.userId, userB.id)));
    expect(memRes2.length).toBe(0);
  }, 60000);
});
