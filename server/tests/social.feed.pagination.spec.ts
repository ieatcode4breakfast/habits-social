import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship, createMockEvent, createTestHabitLog } from './test.utils';
import { sql } from 'drizzle-orm';
import { useDB } from '../utils/db';

describe('Social Feed Pagination & Engine Hardening', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let habitShared: any;
  let habitPrivate: any;
  let habitNoDate: any;
  let friendshipId: string | null = null;

  beforeAll(async () => {
    handler = (await import('../api/social/feed.get')).default;
    userA = await createTestUser(`feed_p_a_${Date.now()}`, `feed_p_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`feed_p_b_${Date.now()}`, `feed_p_b_${Date.now()}@ex.com`);
    
    // 1. Shared Habit (With User Date)
    habitShared = await createTestHabit(userA.id, 'Shared Habit');
    const db = useDB({} as any);
    await db.execute(sql`UPDATE habits SET user_date = '2025-01-01', shared_with = ARRAY[${userB.id}]::text[] WHERE id = ${habitShared.id}::uuid`);

    // 2. Private Habit (With User Date)
    habitPrivate = await createTestHabit(userA.id, 'Private Habit');
    await db.execute(sql`UPDATE habits SET user_date = '2025-01-01' WHERE id = ${habitPrivate.id}::uuid`);

    // 3. Habit with NULL user_date
    habitNoDate = await createTestHabit(userA.id, 'No Date Habit');
    await db.execute(sql`UPDATE habits SET user_date = NULL, shared_with = ARRAY[${userB.id}]::text[] WHERE id = ${habitNoDate.id}::uuid`);

    // Make them friends
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (habitShared?.id) await deleteTestHabit(habitShared.id);
    if (habitPrivate?.id) await deleteTestHabit(habitPrivate.id);
    if (habitNoDate?.id) await deleteTestHabit(habitNoDate.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('Test 1: NULL Date Exclusion - Should not show habits with NULL user_date', async () => {
    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const items = response.data || [];
    const foundNoDate = items.find((i: any) => i.habit?.id === habitNoDate.id);
    expect(foundNoDate).toBeUndefined();
  });

  it('Test 3: Privacy Lockdown - Should see shared habit but NOT private habit of friend', async () => {
    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const items = response.data || [];
    const foundShared = items.find((i: any) => i.habit?.id === habitShared.id);
    const foundPrivate = items.find((i: any) => i.habit?.id === habitPrivate.id);

    expect(foundShared).toBeDefined();
    expect(foundPrivate).toBeUndefined();
  });

  it('Test 2: Type Parity Verification - Should successfully execute UNION with mixed UUID/Text', async () => {
    // This test passes if the handler doesn't throw a SQL error during execution
    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;
    expect(response.data).toBeDefined();
  });

  it('Test 4: Negative Limit Hardening - Should handle negative limit without crashing', async () => {
    // Pass a negative limit string in the query parameter position (5th argument)
    const event = createMockEvent(userB.id, {}, {}, {}, { limit: '-10' }, 'GET');
    
    // This call should NOT throw a 500/SQL error
    const response = (await handler(event)) as any;
    
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('Test 5: Post-Query Grouping Pagination - Should return nextCursor when raw rows > limit', async () => {
    const myId = userA.id!;
    const today = new Date();
    
    // Insert 21 raw events for 21 consecutive days starting from today to pass the date filter
    for (let i = 0; i < 21; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      await createTestHabitLog(myId as string, habitShared.id as string, dateStr as string, 'completed');
    }

    const event = createMockEvent(userA.id!, {}, {}, {}, { limit: '20' }, 'GET');
    const response = (await handler(event)) as any;

    expect(response.nextCursor).toBeDefined();
    expect(response.nextCursor).not.toBeNull();
  });
});
