import './setup';
import { describe, it, expect } from 'vitest';
import { db, createTestUser, createMockEvent } from './test.utils';
import { habits } from '../db/schema';
import { eq } from 'drizzle-orm';
import habitHandler from '../api/habits/index';

describe('Duplicate test', () => {
  it('should not duplicate on same ID and should enforce limit', async () => {
    const ts = Date.now();
    const user = await createTestUser(`dup_test_${ts}`, `dup${ts}@test.com`);
    
    // 1. Create a habit with a specific ID
    const habitId = crypto.randomUUID();
    const event1 = createMockEvent(user.id, { id: habitId, title: 'Test Habit 1' }, {}, {}, {}, 'POST');
    const res1 = await habitHandler(event1);
    console.log('Res 1 ID:', res1?.data?.id);

    // 2. Submit the EXACT same payload again (simulating network retry)
    const event2 = createMockEvent(user.id, { id: habitId, title: 'Test Habit 1' }, {}, {}, {}, 'POST');
    const res2 = await habitHandler(event2);
    console.log('Res 2 ID:', res2?.data?.id);

    // 3. Count habits
    const userHabits = await db.select().from(habits).where(eq(habits.ownerId, user.id));
    console.log('Total habits in DB for user:', userHabits.length);
    expect(userHabits.length).toBe(1); // Should update, not duplicate

    // 4. Try to create bulk habits above the 200 limit
    for (let i = 0; i < 205; i++) {
      try {
        const e = createMockEvent(user.id, { title: `Bulk ${i}` }, {}, {}, {}, 'POST');
        await habitHandler(e);
      } catch (err: any) {
        console.log(`Failed at ${i}:`, err.data?.code || err.statusMessage);
        break; // Should break at 199 (1 already exists)
      }
    }

    const finalHabits = await db.select().from(habits).where(eq(habits.ownerId, user.id));
    console.log('Final habits count:', finalHabits.length);
    expect(finalHabits.length).toBe(200);
  }, 120000);
});
