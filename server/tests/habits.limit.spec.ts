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

  it('should allow creating up to 30 habits', async () => {
    // 1. Create 29 habits directly in DB
    const batch = Array.from({ length: 29 }, (_, i) => ({
      id: crypto.randomUUID(),
      ownerId: testUser.id,
      title: `Habit ${i}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    await db.insert(habitsTable).values(batch);

    // 2. Create the 30th habit via API
    const event30 = createMockEvent(testUser.id, { title: 'Habit 30' }, {}, {}, {}, 'POST');
    const res30 = await handler(event30);
    expect(res30.data.title).toBe('Habit 30');

    // 3. Attempt to create the 31st habit via API
    const event31 = createMockEvent(testUser.id, { title: 'Habit 31' }, {}, {}, {}, 'POST');
    await expect(handler(event31)).rejects.toThrow(/Habit limit of 30 reached/i);
  });

  it('should allow updating an existing habit when at the limit of 30', async () => {
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

