import './setup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import syncGet from '../api/sync.get';
import { SyncService } from '../services/sync.service';
import { createMockEvent, createTestUser, createTestHabit } from './test.utils';

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

  it('should return forceUpdateRequired: true for malformed cursors', async () => {
    // Inject a junk cursor that cannot be decoded
    const junkCursor = 'not-base64-and-no-pipe';

    const event = createMockEvent(testUser.id, {}, {}, {}, { cursors: { habits: junkCursor } });
    const res = await syncGet(event);

    // We expect the server to catch the decoding failure and ask for a reset
    expect(res).toHaveProperty('forceUpdateRequired', true);
  });
});
