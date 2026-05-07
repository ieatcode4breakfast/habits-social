import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestBucket, deleteTestBucket } from './test.utils';

describe('POST /api/bucketlogs', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let bucketA: any;
  let bucketB: any;

  beforeAll(async () => {
    handler = (await import('../api/bucketlogs/index')).default;
    userA = await createTestUser(`a_${Date.now()}`, `a_${Date.now()}@ex.com`);
    userB = await createTestUser(`b_${Date.now()}`, `b_${Date.now()}@ex.com`);
    bucketA = await createTestBucket(userA.id, 'Bucket A');
    bucketB = await createTestBucket(userB.id, 'Bucket B');
  });

  afterAll(async () => {
    if (bucketA?.id) await deleteTestBucket(bucketA.id);
    if (bucketB?.id) await deleteTestBucket(bucketB.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should prevent User B from overwriting User A log via explicit ID (PRR-1)', async () => {
    // User A creates a log
    const dateStr = new Date().toISOString().split('T')[0];
    const logAId = `test_log_a_${Date.now()}`;
    const eventA = createMockEvent(userA.id, {
      id: logAId,
      bucketId: bucketA.id,
      date: dateStr,
      status: 'completed'
    }, {}, {}, {}, 'POST');
    
    await handler(eventA);

    // User B attempts to overwrite User A's log using the same ID, but their own bucket
    const eventB = createMockEvent(userB.id, {
      id: logAId, // The malicious part
      bucketId: bucketB.id,
      date: dateStr,
      status: 'failed'
    }, {}, {}, {}, 'POST');

    // It should either throw an error (because no rows returned) or fail silently, but definitely not overwrite
    try {
      await handler(eventB);
    } catch (e) {
      // It might throw due to returning zero rows
    }

    // Verify User A's log is unchanged
    const getEventA = createMockEvent(userA.id, {}, {}, {}, {}, 'GET');
    const logsA = (await handler(getEventA)) as any;
    
    const targetLog = logsA.data.find((l: any) => l.id === logAId);
    expect(targetLog).toBeDefined();
    expect(targetLog.status).toBe('completed'); // Not 'failed'
    expect(targetLog.bucketId).toBe(bucketA.id); // Not bucketB.id
  });
});
