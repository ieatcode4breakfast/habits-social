import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestBucket, deleteTestBucket } from './test.utils';

describe('GET /api/buckets', () => {
  let handler: any;
  let testUser: any;
  let testBucket: any;

  beforeAll(async () => {
    handler = (await import('../api/buckets/index')).default;
    testUser = await createTestUser(`bucket_u_${Date.now() % 1000000}`, `bucket_${Date.now()}@ex.com`);
    testBucket = await createTestBucket(testUser.id, 'Test Bucket');
  });

  afterAll(async () => {
    if (testBucket?.id) await deleteTestBucket(testBucket.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should safely reject invalid lastSynced strings (PRR-7)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { lastSynced: 'not-a-number' }, 'GET');
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/Invalid lastSynced/i);
  });
});
