import './setup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore - File may not exist yet
import syncBulk from '../api/sync/bulk.post';
import { createMockEvent, createTestUser, createTestHabit, createFriendship, db, type User } from './test.utils';
import { habits as habitsTable, buckets as bucketsTable, bucketHabits, habitLogs, userBlocks } from '../db/schema';
import { eq, and } from 'drizzle-orm';

describe('API: POST /api/sync/bulk', () => {
  let testUser: User;
  let otherUser: User;
  let validFriend: User;

  beforeEach(async () => {
    testUser = await createTestUser(`bulk_sync_${Date.now()}`, `bulk_sync_${Date.now()}@example.com`);
    otherUser = await createTestUser(`bulk_sync_other_${Date.now()}`, `bulk_sync_other_${Date.now()}@example.com`);
    validFriend = await createTestUser(`bulk_sync_valid_${Date.now()}`, `bulk_sync_valid_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, otherUser.id));
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, validFriend.id));
      const { users } = await import('../db/schema');
      await db.delete(users).where(eq(users.id, testUser.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
      await db.delete(users).where(eq(users.id, validFriend.id));
    }
  });

  it('should reject payloads with more than 100 items', async () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'habit',
      data: { id: `h${i}`, title: `Habit ${i}` }
    }));

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    try {
      await syncBulk(event);
      expect.fail('Should have thrown 400/413');
    } catch (e: any) {
      expect(e.statusCode).toBe(400); // or 413
      expect(e.statusMessage).toContain('Too big');
    }
  });

  it('should reject items belonging to another user (Zero-Trust)', async () => {
    const otherHabit = await createTestHabit(otherUser.id, 'Other User Habit');

    const operations = [
      {
        type: 'habit',
        data: { id: otherHabit.id, title: 'I am stealing this' }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);
    
    // Expect the item to be failed in the response or the whole batch rejected
    // The plan says "results in that specific item being rejected (or the whole batch rejected)"
    // Let's assume partial failure response structure: { success: [], failed: [...] }
    expect(response.failed.length).toBe(1);
    expect(response.failed[0]?.id).toBe(otherHabit.id);
  });

  it('should fail child entities if parent entity fails (Cascading Failure)', async () => {
    const invalidHabitId = crypto.randomUUID();
    const operations = [
      {
        type: 'habit',
        data: { id: invalidHabitId, title: '' } // This should fail validation
      },
      {
        type: 'log',
        data: { id: 'l1', habitId: invalidHabitId, date: '2026-01-01', status: 'completed' } // Dependent on the failed habit
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.failed.length).toBe(2);
    // Find the log failure
    const logFailure = response.failed.find((f: any) => f.id === 'l1');
    expect(logFailure).toBeTruthy();
    expect(logFailure?.code).toBe('DEPENDENCY_FAILED');
  });

  it('should successfully process valid operations', async () => {
    const operations = [
      {
        type: 'habit',
        data: { id: crypto.randomUUID(), title: 'Bulk Habit' }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);
    expect(response.failed.length).toBe(0);
  });

  it('should filter blocked recipients from bulk habit sharedWith', async () => {
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    await db.insert(userBlocks).values({
      blockerId: otherUser.id,
      blockedId: testUser.id,
      createdAt: new Date()
    });

    const habitId = crypto.randomUUID();
    const event = createMockEvent(testUser.id, {
      operations: [{
        type: 'habit',
        data: { id: habitId, title: 'Stale Shared Habit', sharedWith: [otherUser.id] }
      }]
    }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.success).toContain(habitId);

    const [habit] = await db.select({ sharedWith: habitsTable.sharedWith })
      .from(habitsTable)
      .where(eq(habitsTable.id, habitId));
    expect(habit?.sharedWith ?? []).not.toContain(otherUser.id);
  });

  it('should preserve valid recipients while filtering blocked recipients from bulk habit sharedWith', async () => {
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    await createFriendship(testUser.id, validFriend.id, 'accepted');
    await db.insert(userBlocks).values({
      blockerId: testUser.id,
      blockedId: otherUser.id,
      createdAt: new Date()
    });

    const habitId = crypto.randomUUID();
    const event = createMockEvent(testUser.id, {
      operations: [{
        type: 'habit',
        data: { id: habitId, title: 'Mixed Shared Habit', sharedWith: [otherUser.id, validFriend.id] }
      }]
    }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.success).toContain(habitId);

    const [habit] = await db.select({ sharedWith: habitsTable.sharedWith })
      .from(habitsTable)
      .where(eq(habitsTable.id, habitId));
    expect(habit?.sharedWith ?? []).not.toContain(otherUser.id);
    expect(habit?.sharedWith ?? []).toContain(validFriend.id);
  });

  it('should filter blocked recipients from bulk habit log sharedWith', async () => {
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    await db.insert(userBlocks).values({
      blockerId: otherUser.id,
      blockedId: testUser.id,
      createdAt: new Date()
    });
    const habit = await createTestHabit(testUser.id, 'Bulk Log Block Habit');
    const logId = `${habit.id}_2026-01-01`;

    const event = createMockEvent(testUser.id, {
      operations: [{
        type: 'log',
        data: {
          id: logId,
          habitId: habit.id,
          date: '2026-01-01',
          status: 'completed',
          sharedWith: [otherUser.id]
        }
      }]
    }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.success).toContain(logId);

    const [log] = await db.select({ sharedWith: habitLogs.sharedWith })
      .from(habitLogs)
      .where(eq(habitLogs.id, logId));
    expect(log?.sharedWith ?? []).not.toContain(otherUser.id);
  });

  it('should successfully process valid bucket operations with habits', async () => {
    const habit = await createTestHabit(testUser.id, 'Test Habit');
    const bucketId = crypto.randomUUID();
    const operations = [
      {
        type: 'bucket',
        data: { id: bucketId, title: 'Bulk Bucket', habitIds: [habit.id] }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);
    expect(response.success[0]).toBe(bucketId);

    const bucketInDb = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketId));
    expect(bucketInDb.length).toBe(1);

    const habitsInBucket = await db.select().from(bucketHabits).where(eq(bucketHabits.bucketId, bucketId));
    expect(habitsInBucket.length).toBe(1);
    expect(habitsInBucket[0]!.habitId).toBe(habit.id);
  });

  it('should ignore invalid habit IDs without crashing', async () => {
    const bucketId = crypto.randomUUID();
    const invalidHabitId = crypto.randomUUID();
    const operations = [
      {
        type: 'bucket',
        data: { id: bucketId, title: 'Bulk Bucket Invalid Habit', habitIds: [invalidHabitId] }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);
    expect(response.success[0]).toBe(bucketId);

    const bucketInDb = await db.select().from(bucketsTable).where(eq(bucketsTable.id, bucketId));
    expect(bucketInDb.length).toBe(1);

    const habitsInBucket = await db.select().from(bucketHabits).where(eq(bucketHabits.bucketId, bucketId));
    expect(habitsInBucket.length).toBe(0);
  });

  it('should preserve foreign habits and handle sharing state', async () => {
    const { createFriendship, shareHabitWithUser } = await import('./test.utils');
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    const foreignHabit = await createTestHabit(otherUser.id, 'Foreign Habit');
    await shareHabitWithUser(foreignHabit.id, testUser.id);

    const bucketId = crypto.randomUUID();
    const operations = [
      {
        type: 'bucket',
        data: { id: bucketId, title: 'Shared Bucket', habitIds: [foreignHabit.id] }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);

    const habitsInBucket = await db.select().from(bucketHabits).where(eq(bucketHabits.bucketId, bucketId));
    expect(habitsInBucket.length).toBe(1);
    expect(habitsInBucket[0]!.habitId).toBe(foreignHabit.id);
    expect(habitsInBucket[0]!.approvalStatus).toBe('pending');
  });

  it('should preserve approvalStatus for foreign habits if already accepted', async () => {
    const { createFriendship, shareHabitWithUser } = await import('./test.utils');
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    const foreignHabit = await createTestHabit(otherUser.id, 'Foreign Habit');
    await shareHabitWithUser(foreignHabit.id, testUser.id);
    
    const bucketId = crypto.randomUUID();
    
    await db.insert(bucketsTable).values({ id: bucketId, ownerId: testUser.id, title: 'Old Title' });
    await db.insert(bucketHabits).values({
      bucketId,
      habitId: foreignHabit.id,
      addedBy: otherUser.id,
      approvalStatus: 'accepted'
    });

    const operations = [
      {
        type: 'bucket',
        data: { id: bucketId, title: 'New Title', habitIds: [foreignHabit.id] }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);

    const habitsInBucket = await db.select().from(bucketHabits).where(eq(bucketHabits.bucketId, bucketId));
    expect(habitsInBucket.length).toBe(1);
    expect(habitsInBucket[0]!.approvalStatus).toBe('accepted');
  });

  it('should calculate streak_count correctly for completed logs processed via bulk sync', async () => {
    // 1. Create a dynamic test habit under the current isolated testUser
    const testHabit = await createTestHabit(testUser.id, 'Bulk Streak Habit');

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const operations = [
      {
        type: 'log',
        data: {
          id: `${testHabit.id}_${yesterdayStr}`,
          habitId: testHabit.id,
          date: yesterdayStr,
          status: 'completed',
          sharedWith: []
        }
      },
      {
        type: 'log',
        data: {
          id: `${testHabit.id}_${todayStr}`,
          habitId: testHabit.id,
          date: todayStr,
          status: 'completed',
          sharedWith: []
        }
      }
    ];

    // 2. Build mock event and execute handler directly
    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    const response = await syncBulk(event);

    expect(response.success).toContain(`${testHabit.id}_${yesterdayStr}`);
    expect(response.success).toContain(`${testHabit.id}_${todayStr}`);

    // 3. Verify database state for dynamic log records
    const { habitLogs } = await import('../db/schema');
    const yesterdayLog = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.id, `${testHabit.id}_${yesterdayStr}`))
      .then((res: any) => res[0]);

    const todayLog = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.id, `${testHabit.id}_${todayStr}`))
      .then((res: any) => res[0]);

    expect(yesterdayLog).toBeDefined();
    expect(yesterdayLog.streakCount).toBe(1);

    expect(todayLog).toBeDefined();
    expect(todayLog.streakCount).toBe(2);
  });

  it('should automatically update affected bucket status and recalculate bucket streaks during bulk sync', async () => {
    // 1. Create dynamic test habit and link to a new test bucket
    const testHabit = await createTestHabit(testUser.id, 'Bucket Checklist Habit');
    const bucketId = crypto.randomUUID();

    await db.insert(bucketsTable).values({ 
      id: bucketId, 
      ownerId: testUser.id, 
      title: 'Daily Checklist' 
    });

    await db.insert(bucketHabits).values({
      bucketId,
      habitId: testHabit.id,
      addedBy: testUser.id,
      approvalStatus: 'accepted'
    });

    const todayStr = new Date().toISOString().split('T')[0] as string;

    const operations = [
      {
        type: 'log',
        data: {
          id: `${testHabit.id}_${todayStr}`,
          habitId: testHabit.id,
          date: todayStr,
          status: 'completed',
          sharedWith: []
        }
      }
    ];

    // 2. Process mock event
    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');
    await syncBulk(event);

    // 3. Verify bucket logs are automatically created and status recalculated
    const { bucketLogs } = await import('../db/schema');
    const bucketLog = await db
      .select()
      .from(bucketLogs)
      .where(
        and(
          eq(bucketLogs.bucketId, bucketId),
          eq(bucketLogs.date, todayStr)
        )
      )
      .then((res: any) => res[0]);

    expect(bucketLog).toBeDefined();
    expect(bucketLog.status).toBe('completed'); // Resolves to 'completed' as single habit in bucket is satisfied
  });
});

