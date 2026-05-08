import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import syncGet from '../api/sync.get';
import { createMockEvent, createTestUser } from './test.utils';

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
});

