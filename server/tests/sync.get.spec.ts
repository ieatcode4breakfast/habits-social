import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import syncGet from '../api/sync.get';
import { SyncService } from '../services/sync.service';
import { createMockEvent, createTestUser, createTestHabit } from './test.utils';

describe('API: GET /api/sync', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`api_sync_${Date.now()}`, `api_sync_${Date.now()}@example.com`);
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
  });

  it('should return 400 for invalid date formats in startDate/endDate', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { startDate: 'invalid-date', endDate: '2024-01-01' });
    try {
      await syncGet(event);
      expect.fail('Should have thrown 400');
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
    }
  });


  it('should return 500 when the database query fails during Promise.all (Failure State Mock)', async () => {

    const { db } = await import('./test.utils');
    const spy = vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('Database connection lost');
    });

    const event = createMockEvent(testUser.id);
    await expect(syncGet(event)).rejects.toThrow(/Database connection lost/i);
    
    spy.mockRestore();
  });

  it('should return forceUpdateRequired: true and empty arrays when payload exceeds safety threshold (Safety Gate)', async () => {
    // Seed massive data (or mock the check)
    // For this test, we'll mock the check logic or seed data if we have a helper
    // Let's seed 6 habits and simulate a threshold of 5 (just for the test)
    for (let i = 0; i < 6; i++) {
      await createTestHabit(testUser.id, `Habit ${i}`);
    }

    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: '0' });
    
    // Mock the safety check to trigger the gate
    const spy = vi.spyOn(SyncService, 'checkV1PayloadSize').mockResolvedValueOnce(true);
    
    const res = await syncGet(event);
    
    expect(res.habits).toHaveLength(0);
    expect(res.buckets).toHaveLength(0);
    expect((res as any).forceUpdateRequired).toBe(true);
    
    spy.mockRestore();
  });
});

