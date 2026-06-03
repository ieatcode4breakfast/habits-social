import './setup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import syncGet from '../api/sync.get';
import { SyncService } from '../services/sync.service';
import { createMockEvent, createTestUser, createTestHabit, createFriendship, deleteTestUser } from './test.utils';
import { eq } from 'drizzle-orm';
import { habitLogs, habits as habitsTable, userBlocks } from '../db/schema';

describe('API: GET /api/sync', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`api_sync_${Date.now()}`, `api_sync_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      const { db } = await import('./test.utils');
      const { habits: habitsTable, users: usersTable } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
      await db.delete(usersTable).where(eq(usersTable.id, testUser.id));
    }
  });


  it('should validate query parameters and return 400 for invalid lastSynced', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: 'not-a-number' });
    
    try {
      await syncGet(event);
      expect.fail('Should have thrown 400');
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      expect(e.statusMessage).toContain('lastSynced');
    }
  });

  it('should successfully sync with valid numeric lastSynced as string', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: '123456789' });
    const res = await syncGet(event);
    expect(res).toHaveProperty('habits');
    expect(res).toHaveProperty('serverTime');
    expect(res).toHaveProperty('nextCursors');
    expect(res).toHaveProperty('hasMore');
  });

  it('should return 500 when the database query fails during Promise.all (Failure State Mock)', async () => {
    const { db } = await import('./test.utils');
    const spy = vi.spyOn(db, 'transaction').mockImplementationOnce(() => {
      throw new Error('Database connection lost');
    });

    const event = createMockEvent(testUser.id);
    await expect(syncGet(event)).rejects.toThrow(/Database connection lost/i);
    
    spy.mockRestore();
  });

  it('should return nextCursors and hasMore on success', async () => {
    await createTestHabit(testUser.id, 'Sync Habit');

    const event = createMockEvent(testUser.id, {}, {}, {}, { limit: '1' });
    const res = await syncGet(event);

    expect(res).toHaveProperty('nextCursors');
    expect(res).toHaveProperty('hasMore');
    expect(res.habits.length).toBeGreaterThan(0);
  });

  it('should not return blocked recipients in synced habit or log sharedWith', async () => {
    const { db } = await import('./test.utils');
    const otherUser = await createTestUser(`api_sync_other_${Date.now()}`, `api_sync_other_${Date.now()}@example.com`);
    const habit = await createTestHabit(testUser.id, 'Stale Sync Shared Habit');
    await createFriendship(testUser.id, otherUser.id, 'accepted');
    await db.update(habitsTable)
      .set({ sharedWith: [otherUser.id], updatedAt: new Date() })
      .where(eq(habitsTable.id, habit.id));
    const logId = `${habit.id}_2026-01-02`;
    await db.insert(habitLogs).values({
      id: logId,
      ownerId: testUser.id,
      habitId: habit.id,
      date: '2026-01-02',
      status: 'completed',
      sharedWith: [otherUser.id],
      updatedAt: new Date()
    });
    await db.insert(userBlocks).values({
      blockerId: otherUser.id,
      blockedId: testUser.id,
      createdAt: new Date()
    });

    const event = createMockEvent(testUser.id, {}, {}, {}, { limit: '50' });
    const res = await syncGet(event);
    const syncedHabit = res.habits.find((item: { id: string }) => item.id === habit.id);
    const syncedLog = res.habitLogs.find((item: { id: string }) => item.id === logId);

    expect(syncedHabit?.sharedWith ?? []).not.toContain(otherUser.id);
    expect(syncedLog?.sharedWith ?? []).not.toContain(otherUser.id);

    await deleteTestUser(otherUser.id);
  });

  it('should return forceUpdateRequired: true for malformed cursors', async () => {
    // Inject a junk cursor that cannot be decoded
    const junkCursor = 'not-base64-and-no-pipe';

    const event = createMockEvent(testUser.id, {}, {}, {}, { cursors: { habits: junkCursor } });
    const res = await syncGet(event);

    // We expect the server to catch the decoding failure and ask for a reset
    expect(res).toHaveProperty('forceUpdateRequired', true);
  });

  it('should return habit streak baselines for windowed partial history sync', async () => {
    const { db } = await import('./test.utils');
    const { habitLogs } = await import('../db/schema');
    const habit = await createTestHabit(testUser.id, 'Baseline Habit');

    await db.insert(habitLogs).values({
      id: `${habit.id}_2026-03-30`,
      ownerId: testUser.id,
      habitId: habit.id,
      date: '2026-03-30',
      status: 'completed',
      streakCount: 39,
      brokenStreakCount: 0,
      sharedWith: [],
      updatedAt: new Date()
    });

    const event = createMockEvent(testUser.id, {}, {}, {}, {
      startDate: '2026-03-31',
      endDate: '2026-05-30'
    });
    const res = await syncGet(event);

    expect(res.habitStreakBaselines).toContainEqual(expect.objectContaining({
      habitId: habit.id,
      ownerId: testUser.id,
      startDate: '2026-03-31',
      endDate: '2026-05-30',
      baselineDate: '2026-03-30',
      baselineCurrentStreak: 39,
      baselineLongestStreak: 39,
      baselineStreakAnchorDate: '2026-03-30'
    }));
  });

  it('should return bucket streak baselines for windowed partial history sync', async () => {
    const { db } = await import('./test.utils');
    const { bucketLogs, buckets: bucketsTable } = await import('../db/schema');
    const bucketId = crypto.randomUUID();

    await db.insert(bucketsTable).values({
      id: bucketId,
      ownerId: testUser.id,
      title: 'Baseline Bucket',
      description: '',
      color: '#6366f1',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.insert(bucketLogs).values({
      id: `${bucketId}_2026-03-30_${testUser.id}`,
      ownerId: testUser.id,
      bucketId,
      date: '2026-03-30',
      status: 'completed',
      streakCount: 39,
      brokenStreakCount: 0,
      updatedAt: new Date()
    });

    const event = createMockEvent(testUser.id, {}, {}, {}, {
      startDate: '2026-03-31',
      endDate: '2026-05-30'
    });
    const res = await syncGet(event);

    expect(res.bucketStreakBaselines).toContainEqual(expect.objectContaining({
      bucketId,
      ownerId: testUser.id,
      startDate: '2026-03-31',
      endDate: '2026-05-30',
      baselineDate: '2026-03-30',
      baselineCurrentStreak: 39,
      baselineLongestStreak: 39,
      baselineStreakAnchorDate: '2026-03-30'
    }));
  });
});
