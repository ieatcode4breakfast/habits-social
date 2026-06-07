import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, db } from './test.utils';
import { habits as habitsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('POST /api/habits - Limit Enforcement', () => {
  let handler: any;
  let testUser: any;

  beforeAll(async () => {
    handler = (await import('../api/habits/index')).default;
    testUser = await createTestUser(`limit_h_${Date.now() % 1000000}`, `limit_h_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (testUser?.id) {
        await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
        await deleteTestUser(testUser.id);
    }
  });

  it('should allow creating up to 200 habits', async () => {
    // 1. Create 199 habits directly in DB
    const batch = Array.from({ length: 199 }, (_, i) => ({
      id: crypto.randomUUID(),
      ownerId: testUser.id,
      title: `Habit ${i}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    await db.insert(habitsTable).values(batch);

    // 2. Create the 200th habit via API
    const event200 = createMockEvent(testUser.id, { title: 'Habit 200' }, {}, {}, {}, 'POST');
    const res200 = await handler(event200);
    expect(res200.data.title).toBe('Habit 200');

    // 3. Attempt to create the 201st habit via API
    const event201 = createMockEvent(testUser.id, { title: 'Habit 201' }, {}, {}, {}, 'POST');
    await expect(handler(event201)).rejects.toThrow(/Habit limit of 200 reached/i);
  });

  it('should allow updating an existing habit when at the limit of 200', async () => {
    const existing = await db.select()
      .from(habitsTable)
      .where(eq(habitsTable.ownerId, testUser.id))
      .limit(1);
    
    expect(existing.length).toBe(1);
    const habitToUpdate = existing[0]!;


    const eventUpdate = createMockEvent(testUser.id, { 
      id: habitToUpdate.id, 
      title: 'Updated Habit Title' 
    }, {}, {}, {}, 'POST');
    
    const resUpdate = await handler(eventUpdate);
    expect(resUpdate.data.title).toBe('Updated Habit Title');
  });
});

