import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, db } from './test.utils';
import { buckets as bucketsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('POST /api/buckets - Limit Enforcement', () => {
  let handler: any;
  let testUser: any;

  beforeAll(async () => {
    handler = (await import('../api/buckets/index')).default;
    testUser = await createTestUser(`limit_u_${Date.now() % 1000000}`, `limit_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (testUser?.id) {
        await db.delete(bucketsTable).where(eq(bucketsTable.ownerId, testUser.id));
        await deleteTestUser(testUser.id);
    }
  });

  it('should allow creating up to 50 buckets', async () => {
    // 1. Create 49 buckets directly in DB
    const batch = Array.from({ length: 49 }, (_, i) => ({
      id: crypto.randomUUID(),
      ownerId: testUser.id,
      title: `Bucket ${i}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    await db.insert(bucketsTable).values(batch);

    // 2. Create the 50th bucket via API
    const event50 = createMockEvent(testUser.id, { title: 'Bucket 50' }, {}, {}, {}, 'POST');
    const res50 = await handler(event50);
    expect(res50.data.title).toBe('Bucket 50');

    // 3. Attempt to create the 51st bucket via API
    const event51 = createMockEvent(testUser.id, { title: 'Bucket 51' }, {}, {}, {}, 'POST');
    await expect(handler(event51)).rejects.toThrow(/Bucket limit of 50 reached/i);
  });
});
