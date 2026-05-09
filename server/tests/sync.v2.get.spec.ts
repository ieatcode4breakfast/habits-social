import './setup';
import { describe, it, expect, beforeEach } from 'vitest';
import syncV2Get from '../api/v2/sync.get';
import { 
  createTestUser, 
  createTestHabit, 
  createMockEvent,
  db 
} from './test.utils';

describe('API: GET /api/v2/sync', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`sync_api_${Date.now()}`, `sync_api_${Date.now()}@example.com`);
  });

  it('should return nextCursors and hasMore on success', async () => {
    await createTestHabit(testUser.id, 'Sync Habit');

    const event = createMockEvent(testUser.id, {}, {}, {}, { limit: '1' });
    const res = await syncV2Get(event);

    expect(res).toHaveProperty('nextCursors');
    expect(res).toHaveProperty('hasMore');
    expect(res.habits.length).toBeGreaterThan(0);
  });

  it('should return forceUpdateRequired: true for malformed cursors', async () => {
    // Inject a junk cursor that cannot be decoded
    const junkCursor = 'not-base64-and-no-pipe';

    const event = createMockEvent(testUser.id, {}, {}, {}, { cursors: { habits: junkCursor } });
    const res = await syncV2Get(event);

    // We expect the server to catch the decoding failure and ask for a reset
    expect(res).toHaveProperty('forceUpdateRequired', true);
  });
});
