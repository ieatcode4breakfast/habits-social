import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  createTestUser, 
  deleteTestUser, 
  createTestHabit, 
  createTestBucket, 
  createMockEvent,
  db,
  User,
  Habit,
  Bucket,
  createTestHabitLog
} from './test.utils';
import { bucketHabits, bucketLogs, buckets as bucketsTable, habits as habitsTable, habitLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { SyncService } from '../services/sync.service';
import { reevaluateMultipleBuckets } from '../utils/buckets';
import bucketIdHandler from '../api/buckets/[id]';
import bucketsIndexHandler from '../api/buckets/index';

describe('Legacy / Cross-owner Bucket Habits Defensive Filtering', () => {
  let userA: User;
  let userB: User;
  let habitA: Habit;
  let bucketB: Bucket;

  beforeAll(async () => {
    userA = await createTestUser(`leg_A_${Date.now()}`, `leg_A_${Date.now()}@ex.com`);
    userB = await createTestUser(`leg_B_${Date.now()}`, `leg_B_${Date.now()}@ex.com`);

    // User A owns habitA
    habitA = await createTestHabit(userA.id, 'User A Habit');

    // User B owns bucketB
    bucketB = await createTestBucket(userB.id, 'User B Bucket');

    // Seed a legacy cross-owner row directly in db bypassing APIs
    await db.insert(bucketHabits).values({
      bucketId: bucketB.id,
      habitId: habitA.id
    });
  });

  afterAll(async () => {
    await db.delete(bucketHabits).where(eq(bucketHabits.bucketId, bucketB.id));
    if (bucketB?.id) await db.delete(bucketLogs).where(eq(bucketLogs.bucketId, bucketB.id));
    if (bucketB?.id) await db.delete(bucketsTable).where(eq(bucketsTable.id, bucketB.id));
    if (habitA?.id) await db.delete(habitsTable).where(eq(habitsTable.id, habitA.id));
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('GET /api/buckets/[id] should defensively exclude cross-owner habits', async () => {
    const event = createMockEvent(userB.id, {}, {}, { id: bucketB.id }, {}, 'GET');
    const response = (await bucketIdHandler(event)) as any;
    expect(response.data.habitIds).not.toContain(habitA.id);
  });

  it('GET /api/buckets should defensively exclude cross-owner habits', async () => {
    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await bucketsIndexHandler(event)) as any;
    const matchedBucket = response.data.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('SyncService.getDeltas should defensively exclude cross-owner habits in stitched buckets', async () => {
    const deltas = await SyncService.getDeltas(db, userB.id, { lastSynced: 0 });
    const matchedBucket = deltas.buckets.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('SyncService.getPaginatedDeltas should defensively exclude cross-owner habits in stitched buckets', async () => {
    const deltas = await SyncService.getPaginatedDeltas(db, userB.id, { lastSynced: 0 });
    const matchedBucket = deltas.buckets.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('reevaluateMultipleBuckets should not count cross-owner habits for streak/log calculations', async () => {
    // If habitA was counted, and since there is no log for it by userB, the bucket log status would be 'cleared'
    // but since it's defensively ignored, the bucket actually has 0 valid habits.
    // Let's create a valid habit for userB inside bucketB first.
    const habitB = await createTestHabit(userB.id, 'User B Habit');
    await db.insert(bucketHabits).values({
      bucketId: bucketB.id,
      habitId: habitB.id
    });

    try {
      // Create a completed log for userB's habitB
      await createTestHabitLog(userB.id, habitB.id, '2026-05-30', 'completed');

      // Reevaluate logs for bucketB
      await reevaluateMultipleBuckets(db, [{ bucketId: bucketB.id, ownerId: userB.id }]);

      // Get bucket log status
      const logs = await db.select()
        .from(bucketLogs)
        .where(and(eq(bucketLogs.bucketId, bucketB.id), eq(bucketLogs.date, '2026-05-30')));

      expect(logs).toHaveLength(1);
      // It should be 'completed' because the only valid habit (habitB) is completed.
      // If the legacy row (habitA) was counted, it would be 'cleared' (since habitA is missing).
      expect(logs[0]?.status).toBe('completed');
    } finally {
      await db.delete(bucketHabits).where(eq(bucketHabits.habitId, habitB.id));
      await db.delete(habitLogs).where(eq(habitLogs.habitId, habitB.id));
      await db.delete(habitsTable).where(eq(habitsTable.id, habitB.id));
    }
  });

  it('POST /api/buckets (upsert) should defensively exclude cross-owner habits in the response', async () => {
    const event = createMockEvent(userB.id, {
      id: bucketB.id,
      title: 'User B Bucket Upserted'
    }, {}, {}, {}, 'POST');

    const response = (await bucketsIndexHandler(event)) as any;
    expect(response.data.habitIds).not.toContain(habitA.id);
  });
});
