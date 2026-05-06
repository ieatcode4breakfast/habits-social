import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestBucket, deleteTestBucket } from './test.utils';

describe('API /api/v2/buckets/[id]', () => {
  let handler: any;
  let testUser: any;
  let testBucket: any;

  beforeAll(async () => {
    handler = (await import('../buckets/[id]')).default;
    testUser = await createTestUser(`b_crud_${Date.now()}`, `b_crud_${Date.now()}@ex.com`);
    testBucket = await createTestBucket(testUser.id, 'Initial Bucket');
  });

  afterAll(async () => {
    if (testBucket?.id) await deleteTestBucket(testBucket.id);
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should get a specific bucket', async () => {
    const event = createMockEvent(testUser.id, {}, {}, { id: testBucket.id }, {}, 'GET');
    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testBucket.id);
    expect(response.data.title).toBe('Initial Bucket');
  });

  it('should update a bucket', async () => {
    const event = createMockEvent(testUser.id, { title: 'Updated Bucket' }, {}, { id: testBucket.id }, {}, 'PUT');
    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
    expect(response.data.title).toBe('Updated Bucket');
  });

  it('should safely delete a bucket', async () => {
    const newBucket = await createTestBucket(testUser.id, 'To Delete');
    const event = createMockEvent(testUser.id, {}, {}, { id: newBucket.id }, {}, 'DELETE');
    const response = (await handler(event)) as any;
    expect(response.data.success).toBe(true);
  });
});
