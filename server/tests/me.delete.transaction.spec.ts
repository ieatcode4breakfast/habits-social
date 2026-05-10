import './setup';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit } from './test.utils';
import { useDB } from '../utils/db';
import { habits as habitsTable, users as usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Atomic User Deletion (Transaction Test)', () => {
  let testUser: any;
  let testHabit: any;
  let handler: any;

  beforeAll(async () => {
    handler = (await import('../api/users/me.delete')).default;
  });

  it('should FAIL to rollback without a transaction (Red Phase)', async () => {
    // 1. Setup: Create user and habit
    testUser = await createTestUser(`t_at_1_${Date.now() % 1000}`, `at1_${Date.now()}@ex.com`);
    testHabit = await createTestHabit(testUser.id, 'Atomic Test Habit');

    const db = useDB();
    const originalTransaction = db.transaction.bind(db);
    
    // 2. Mock: Wrap the real transaction to inject a failure inside it
    vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
      return await originalTransaction(async (tx: any) => {
        const originalDelete = tx.delete.bind(tx);
        const poisonedTx = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === 'delete') {
              return (table: any) => {
                // Fail ONLY on the final users table delete to trigger REAL rollback
                if (table === usersTable) {
                  throw new Error('SIMULATED_DB_FAILURE_AT_END');
                }
                return originalDelete(table);
              };
            }
            return Reflect.get(target, prop, receiver);
          }
        });
        return await callback(poisonedTx as any);
      });
    });

    const event = createMockEvent(testUser.id);
    event.context.useDB = () => db; 

    // 3. Action: Attempt deletion (expected to throw)
    await expect(handler(event)).rejects.toThrow('SIMULATED_DB_FAILURE_AT_END');

    // 4. Verification: 
    // WITHOUT a transaction, the habit is ALREADY DELETED even though the user deletion failed.
    const habitsAfterFailure = await db.select().from(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
    
    // In Red Phase, this will be 1 (Wait, it should be 1 if it rolled back, but it will be 0 now)
    // We expect 1 because we WANT it to rollback.
    expect(habitsAfterFailure.length).toBe(1); 

    // Cleanup
    await deleteTestUser(testUser.id);
  });
});
