import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createTestBucket, deleteTestBucket, User, Habit, Bucket, db, createTestHabitLog } from './test.utils';
import { HabitService } from '../services/habit.service';
import { BucketService } from '../services/bucket.service';
import { eq, and } from 'drizzle-orm';
import { syncDeletions, habits, buckets, habitLogs } from '../db/schema';

describe('Security & Sync Deletion Integrity', () => {
  let userA: User;
  let userB: User;
  let habitA: Habit;
  let bucketA: Bucket;

  beforeAll(async () => {
    userA = await createTestUser(`sec_A_${Date.now()}`, `sec_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`sec_B_${Date.now()}`, `sec_B_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'User A Habit');
    bucketA = await createTestBucket(userA.id, 'User A Bucket');
  });

  afterAll(async () => {
    // Cleanup sync deletions first due to references if any, though schema says cascade on user
    await db.delete(syncDeletions).where(eq(syncDeletions.ownerId, userA.id));
    await db.delete(syncDeletions).where(eq(syncDeletions.ownerId, userB.id));
    
    if (bucketA?.id) await deleteTestBucket(bucketA.id);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  describe('HabitService.deleteHabit', () => {
    it('should prevent User B from deleting User A habit (IDOR)', async () => {
      // Expectation: Service should throw 403
      let error: any;
      try {
        await HabitService.deleteHabit(db, userB.id, habitA.id, null);
      } catch (e: any) {
        error = e;
      }
      
      expect(error?.statusCode).toBe(403);
      
      // Verify habit still exists
      const hRes = await db.select().from(habits).where(eq(habits.id, habitA.id));
      expect(hRes.length).toBe(1);
    });

    it('should correctly attribute sync_deletions to the OWNER', async () => {
        const habitToDelete = await createTestHabit(userA.id, 'Delete Me');
        await HabitService.deleteHabit(db, userA.id, habitToDelete.id, null);
        
        const delRes = await db.select().from(syncDeletions).where(eq(syncDeletions.entityId, habitToDelete.id));
        expect(delRes.length).toBe(1);
        expect(delRes[0].ownerId).toBe(userA.id);
        expect(delRes[0].entityType).toBe('habit');
    });
  });

  describe('BucketService.deleteBucket', () => {
    it('should prevent User B from deleting User A bucket (IDOR)', async () => {
      let error: any;
      try {
        await BucketService.deleteBucket(db, userB.id, bucketA.id, null);
      } catch (e: any) {
        error = e;
      }
      
      expect(error?.statusCode).toBe(403);
      
      const bRes = await db.select().from(buckets).where(eq(buckets.id, bucketA.id));
      expect(bRes.length).toBe(1);
    });

    it('should correctly attribute sync_deletions to the OWNER', async () => {
        const bucketToDelete = await createTestBucket(userA.id, 'Delete Bucket');
        await BucketService.deleteBucket(db, userA.id, bucketToDelete.id, null);
        
        const delRes = await db.select().from(syncDeletions).where(eq(syncDeletions.entityId, bucketToDelete.id));
        expect(delRes.length).toBe(1);
        expect(delRes[0].ownerId).toBe(userA.id);
        expect(delRes[0].entityType).toBe('bucket');
    });
  });

  describe('BucketService.updateBucket', () => {
    it('should prevent User B from updating User A bucket (IDOR)', async () => {
      let error: any;
      try {
        await BucketService.updateBucket(db, userB.id, bucketA.id, { title: 'Hacked' }, bucketA, null);
      } catch (e: any) {
        error = e;
      }
      
      expect(error?.statusCode).toBe(403);
      
      const bRes = await db.select().from(buckets).where(eq(buckets.id, bucketA.id));
      expect(bRes[0].title).toBe('User A Bucket');
    });
  });

  describe('HabitService.deleteHabitLog (Sync Parity)', () => {
    it('should create a sync_deletions entry when a habit log is deleted', async () => {
      const date = '2024-05-15';
      const log = await createTestHabitLog(userA.id, habitA.id, date);
      
      await HabitService.deleteHabitLog(db, userA.id, habitA.id, date, null);
      
      const delRes = await db.select().from(syncDeletions).where(and(
        eq(syncDeletions.entityId, log.id),
        eq(syncDeletions.entityType, 'habit_log')
      ));
      
      expect(delRes.length).toBe(1);
      expect(delRes[0].ownerId).toBe(userA.id);
    });
  });
});
