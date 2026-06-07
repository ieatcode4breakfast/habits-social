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

  it('should allow creating up to 200 buckets', async () => {
    // 1. Create 199 buckets directly in DB
    const batch = Array.from({ length: 199 }, (_, i) => ({
      id: crypto.randomUUID(),
      ownerId: testUser.id,
      title: `Bucket ${i}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    await db.insert(bucketsTable).values(batch);

    // 2. Create the 200th bucket via API
    const event200 = createMockEvent(testUser.id, { title: 'Bucket 200' }, {}, {}, {}, 'POST');
    const res200 = await handler(event200);
    expect(res200.data.title).toBe('Bucket 200');

    // 3. Attempt to create the 201st bucket via API
    const event201 = createMockEvent(testUser.id, { title: 'Bucket 201' }, {}, {}, {}, 'POST');
    await expect(handler(event201)).rejects.toThrow(/Bucket limit of 200 reached/i);
  });

  it('should allow updating an existing bucket when at the limit of 200', async () => {
    const existing = await db.select()
      .from(bucketsTable)
      .where(eq(bucketsTable.ownerId, testUser.id))
      .limit(1);
    
    expect(existing.length).toBe(1);
    const bucketToUpdate = existing[0]!;


    const eventUpdate = createMockEvent(testUser.id, { 
      id: bucketToUpdate.id, 
      title: 'Updated Bucket Title' 
    }, {}, {}, {}, 'POST');
    
    const resUpdate = await handler(eventUpdate);
    expect(resUpdate.data.title).toBe('Updated Bucket Title');
  });
});

