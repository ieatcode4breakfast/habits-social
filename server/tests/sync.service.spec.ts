import './setup';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncService } from '../services/sync.service';
import { createTestUser, createTestHabit, createTestBucket, deleteTestUser, db } from './test.utils';
import * as schema from '../db/schema';
import { bucketHabits, sharedBucketMembers } from '../db/schema';

describe('SyncService', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`sync_user_${Date.now()}`, `sync_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      const { eq } = await import('drizzle-orm');
      await db.delete(schema.bucketHabits).where(eq(schema.bucketHabits.addedBy, testUser.id));
      await db.delete(schema.buckets).where(eq(schema.buckets.ownerId, testUser.id));
      await db.delete(schema.habits).where(eq(schema.habits.ownerId, testUser.id));
      await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
    }
  });


  it('should return empty deltas for a new user with lastSynced=0', async () => {
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: 0 });
    expect(res.habits).toHaveLength(0);
    expect(res.buckets).toHaveLength(0);
    expect(res.habitLogs).toHaveLength(0);
    expect(res.serverTime).toBeGreaterThan(0);
  });

  it('should return new habits created after lastSynced', async () => {
    const lastSynced = Date.now() - 10000;
    await createTestHabit(testUser.id, 'New Habit');
    
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced });
    expect(res.habits).toHaveLength(1);
    expect(res.habits[0].title).toBe('New Habit');
  });

  it('should handle extreme future lastSynced dates gracefully', async () => {
    const futureDate = Date.now() + 10000000;
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: futureDate });
    expect(res.habits).toHaveLength(0);
  });

  it('should handle negative lastSynced by treating it as 0', async () => {
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: -100 });
    expect(res.serverTime).toBeGreaterThan(0);
  });

  it('should optimize bucket metadata and avoid crashes on empty state', async () => {
    // This test ensures the inArray logic doesn't crash
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: 0 });
    expect(res.buckets).toHaveLength(0);
  });

  it('should avoid Cartesian product duplication when a bucket has multiple habits and members', async () => {
    // 1. Setup: 1 bucket, 2 habits in it, 2 other members shared
    const bucket = await createTestBucket(testUser.id, 'Social Bucket');
    
    const h1 = await createTestHabit(testUser.id, 'Habit 1');
    const h2 = await createTestHabit(testUser.id, 'Habit 2');

    // Add habits to bucket
    await db.insert(schema.bucketHabits).values([
      { bucketId: bucket.id, habitId: h1.id, addedBy: testUser.id },
      { bucketId: bucket.id, habitId: h2.id, addedBy: testUser.id }
    ]);

    // Add other members to bucket
    const otherUser1 = await createTestUser(`other_1_${Date.now()}`, `other1_${Date.now()}@example.com`);
    const otherUser2 = await createTestUser(`other_2_${Date.now()}`, `other2_${Date.now()}@example.com`);
    
    await db.insert(schema.sharedBucketMembers).values([
      { bucketId: bucket.id, userId: otherUser1.id, status: 'accepted' },
      { bucketId: bucket.id, userId: otherUser2.id, status: 'accepted' }
    ]);

    // 2. Sync
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: 0 });

    // 3. Assertions
    const syncedBucket = res.buckets.find(b => b.id === bucket.id);
    expect(syncedBucket).toBeDefined();
    
    // In a Cartesian product (2 habits * 2 members), these would have been length 4 or 6.
    // They should be exactly 2 and 2.
    expect(syncedBucket.habitIds).toHaveLength(2);
    expect(syncedBucket.sharedHabits).toHaveLength(2);
    expect(syncedBucket.sharedMembers).toHaveLength(2);

    // Cleanup
    await deleteTestUser(otherUser1.id);
    await deleteTestUser(otherUser2.id);
  });
});
