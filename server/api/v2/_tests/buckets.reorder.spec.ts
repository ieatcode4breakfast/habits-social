import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestBucket, deleteTestBucket } from './test.utils';

describe('POST /api/v2/buckets/reorder', () => {
  let handler: any;
  let testUser: any;
  let bucket1: any;
  let bucket2: any;

  beforeAll(async () => {
    handler = (await import('../buckets/reorder')).default;
    testUser = await createTestUser(`b_reo_${Date.now()}`, `b_reo_${Date.now()}@ex.com`);
    bucket1 = await createTestBucket(testUser.id, 'Bucket 1');
    bucket2 = await createTestBucket(testUser.id, 'Bucket 2');
  });

  afterAll(async () => {
    if (bucket1?.id) await deleteTestBucket(bucket1.id);
    if (bucket2?.id) await deleteTestBucket(bucket2.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should reorder buckets successfully', async () => {
    const event = createMockEvent(testUser.id, {
      ids: [bucket1.id, bucket2.id]
    }, {}, {}, {}, 'POST');

    const response = (await handler(event)) as any;
    expect(response.data.success).toBe(true);

    // Verify ordering
    const getHandler = (await import('../buckets/index')).default;
    const getEvent = createMockEvent(testUser.id, {}, {}, {}, {}, 'GET');
    getEvent.context.userId = testUser.id;
    const getResponse = (await getHandler(getEvent)) as any;
    
    const b1 = getResponse.data.find((b: any) => b.id === bucket1.id);
    const b2 = getResponse.data.find((b: any) => b.id === bucket2.id);
    
    expect(b1.sortOrder).toBe(0);
    expect(b2.sortOrder).toBe(1);
  });
});
