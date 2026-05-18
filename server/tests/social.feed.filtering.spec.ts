import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';
import { useDB } from '../utils/db';
import { habitLogs, habits as habitsTable, shareEvents } from '../db/schema';
import { formatISO, subDays } from 'date-fns';
import { eq } from 'drizzle-orm';

describe('GET /api/social/feed - Filtering', () => {
  let handler: any;
  let userA: any; // Sharer
  let userB: any; // Viewer
  let habitA: any;
  let friendshipId: string | null = null;
  const db = useDB();

  beforeAll(async () => {
    handler = (await import('../api/social/feed.get')).default;
    userA = await createTestUser(`ff_a_${Date.now()}`, `ff_a_${Date.now()}@ex.com`);
    userB = await createTestUser(`ff_b_${Date.now()}`, `ff_b_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Filter Habit');

    // Make them friends
    const fs = await createFriendship(userA.id, userB.id, 'accepted');
    friendshipId = fs!.id;

    // Share habit
    await db.update(habitsTable)
      .set({ sharedWith: [userB.id] })
      .where(eq(habitsTable.id, habitA.id));
  });

  afterAll(async () => {
    if (friendshipId) await deleteFriendship(friendshipId);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  const getTodayStr = () => formatISO(new Date(), { representation: 'date' });
  const getYesterdayStr = () => formatISO(subDays(new Date(), 1), { representation: 'date' });

  it('Test 1: Today events are never filtered', async () => {
    const today = getTodayStr();
    const logId = `t1_${Date.now()}`;
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: habitA.id,
      ownerId: userA.id,
      date: today,
      status: 'completed',
      streakCount: 1,
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const found = response.data.find((item: any) => item.date === today && item.habit?.id === habitA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
  });

  it('Test 2: Yesterday standard logs are filtered', async () => {
    const yesterday = getYesterdayStr();
    const logId = `t2_${Date.now()}`;
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: habitA.id,
      ownerId: userA.id,
      date: yesterday,
      status: 'completed',
      streakCount: 6, // Non-milestone
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const found = response.data.find((item: any) => item.date === yesterday && item.habit?.id === habitA.id);
    expect(found).toBeUndefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
  });

  it('Test 3: Yesterday Milestones are kept', async () => {
    const yesterday = getYesterdayStr();
    const logId = `t3_${Date.now()}`;
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: habitA.id,
      ownerId: userA.id,
      date: yesterday,
      status: 'completed',
      streakCount: 5, // Milestone
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const found = response.data.find((item: any) => item.date === yesterday && item.habit?.id === habitA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
  });

  it('Test 4: Yesterday Broken Streaks are kept', async () => {
    const yesterday = getYesterdayStr();
    const logId = `t4_${Date.now()}`;
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: habitA.id,
      ownerId: userA.id,
      date: yesterday,
      status: 'failed',
      brokenStreakCount: 2, // Broken streak > 1
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const found = response.data.find((item: any) => item.date === yesterday && item.habit?.id === habitA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
  });

  it('Test 5: Yesterday Veteran Milestones are kept', async () => {
    const yesterday = getYesterdayStr();
    const logId = `t5_${Date.now()}`;
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: habitA.id,
      ownerId: userA.id,
      date: yesterday,
      status: 'completed',
      streakCount: 370, // 365 + 5
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    const found = response.data.find((item: any) => item.date === yesterday && item.habit?.id === habitA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
  });
  it('Test 6: Yesterday Commitments are kept', async () => {
    const yesterday = getYesterdayStr();
    
    // Update habit to have userDate = yesterday
    await db.update(habitsTable)
      .set({ userDate: yesterday })
      .where(eq(habitsTable.id, habitA.id));

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    // Find the commitment in the feed
    const found = response.data.find((item: any) => item.date === yesterday && item.user.id === userA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.update(habitsTable)
      .set({ userDate: null })
      .where(eq(habitsTable.id, habitA.id));
  });

  it('Test 7: Yesterday Share Events are kept', async () => {
    const yesterday = getYesterdayStr();
    const shareId = crypto.randomUUID();
    
    await db.insert(shareEvents).values({
      id: shareId,
      ownerId: userA.id,
      recipientId: userB.id,
      habitIds: [habitA.id],
      userDate: yesterday,
      createdAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    // Find the share event in the feed
    const found = response.data.find((item: any) => item.date === yesterday && item.user.id === userA.id);
    expect(found).toBeDefined();
    
    // Cleanup
    await db.delete(shareEvents).where(eq(shareEvents.id, shareId));
  });

  it('Test 8: Unshared habits do not leak weekly logs', async () => {
    const today = formatISO(new Date(), { representation: 'date' });
    const logId = `t8_${Date.now()}`;
    
    // Create a new habit for userA that is NOT shared with userB
    const privateHabit = await createTestHabit(userA.id, 'Private Habit');
    
    await db.insert(habitLogs).values({
      id: logId,
      habitId: privateHabit.id,
      ownerId: userA.id,
      date: today,
      status: 'completed',
      streakCount: 1,
      updatedAt: new Date()
    });

    const event = createMockEvent(userB.id, {}, {}, {}, {}, 'GET');
    const response = (await handler(event)) as any;

    // Verify that the log does NOT appear in userB's feed
    const found = response.data.find((item: any) => item.habit?.id === privateHabit.id);
    expect(found).toBeUndefined();
    
    // Cleanup
    await db.delete(habitLogs).where(eq(habitLogs.id, logId));
    await deleteTestHabit(privateHabit.id);
  });
});
