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

describe('Bucket Habit Ownership Boundaries', () => {
  let userA: User;
  let userB: User;
  let habitA: Habit;
  let bucketB: Bucket;

  beforeAll(async () => {
    userA = await createTestUser(`owner_a_${Date.now()}`, `owner_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`owner_b_${Date.now()}`, `owner_b_${Date.now()}@ex.com`);

    // User A owns habitA
    habitA = await createTestHabit(userA.id, 'User A Habit');

    // User B owns bucketB
    bucketB = await createTestBucket(userB.id, 'User B Bucket');

    // Seed a non-owned habit directly in the DB bypassing the APIs to test defensive boundaries
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

  it('should NOT allow a user to link another user\'s habit to their bucket', async () => {
    const putEvent = createMockEvent(userB.id, {
      habitIds: [habitA.id]
    }, {}, { id: bucketB.id }, {}, 'PUT');

    const putResponse = (await bucketIdHandler(putEvent)) as any;
    expect(putResponse.data.habitIds).not.toContain(habitA.id);
  });

  it('should ignore nonexistent or random habit IDs in bucket operations', async () => {
    const randomHabitId = crypto.randomUUID();
    const putEvent = createMockEvent(userB.id, {
      habitIds: [randomHabitId]
    }, {}, { id: bucketB.id }, {}, 'PUT');

    const putResponse = (await bucketIdHandler(putEvent)) as any;
    expect(putResponse.data.habitIds).not.toContain(randomHabitId);

    const habitsInDb = await db.select()
      .from(bucketHabits)
      .where(and(eq(bucketHabits.bucketId, bucketB.id), eq(bucketHabits.habitId, randomHabitId)));
    expect(habitsInDb).toHaveLength(0);
  });

  it('GET /api/buckets/[id] should defensively exclude habits owned by other users', async () => {
    const event = createMockEvent(userB.id, {}, {}, { id: bucketB.id }, {}, 'GET');
    const response = (await bucketIdHandler(event)) as any;
    expect(response.data.habitIds).not.toContain(habitA.id);
  });

  it('GET /api/buckets should defensively exclude habits owned by other users', async () => {
    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await bucketsIndexHandler(event)) as any;
    const matchedBucket = response.data.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('SyncService.getDeltas should defensively exclude non-owned habits in stitched buckets', async () => {
    const deltas = await SyncService.getDeltas(db, userB.id, { lastSynced: 0 });
    const matchedBucket = deltas.buckets.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('SyncService.getPaginatedDeltas should defensively exclude non-owned habits in stitched buckets', async () => {
    const deltas = await SyncService.getPaginatedDeltas(db, userB.id, { lastSynced: 0 });
    const matchedBucket = deltas.buckets.find((b: any) => b.id === bucketB.id);
    expect(matchedBucket).toBeDefined();
    expect(matchedBucket.habitIds).not.toContain(habitA.id);
  });

  it('reevaluateMultipleBuckets should not count non-owned habits for streak/log calculations', async () => {
    const habitB = await createTestHabit(userB.id, 'User B Habit');
    await db.insert(bucketHabits).values({
      bucketId: bucketB.id,
      habitId: habitB.id
    });

    try {
      await createTestHabitLog(userB.id, habitB.id, '2026-05-30', 'completed');
      await reevaluateMultipleBuckets(db, [{ bucketId: bucketB.id, ownerId: userB.id }]);

      const logs = await db.select()
        .from(bucketLogs)
        .where(and(eq(bucketLogs.bucketId, bucketB.id), eq(bucketLogs.date, '2026-05-30')));

      expect(logs).toHaveLength(1);
      expect(logs[0]?.status).toBe('completed');
    } finally {
      await db.delete(bucketHabits).where(eq(bucketHabits.habitId, habitB.id));
      await db.delete(habitLogs).where(eq(habitLogs.habitId, habitB.id));
      await db.delete(habitsTable).where(eq(habitsTable.id, habitB.id));
    }
  });

  it('POST /api/buckets (upsert) should defensively exclude non-owned habits in the response', async () => {
    const event = createMockEvent(userB.id, {
      id: bucketB.id,
      title: 'User B Bucket Upserted'
    }, {}, {}, {}, 'POST');

    const response = (await bucketsIndexHandler(event)) as any;
    expect(response.data.habitIds).not.toContain(habitA.id);
  });
});
