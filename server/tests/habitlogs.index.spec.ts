import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, db } from './test.utils';
import { formatISO } from 'date-fns';
import { eq } from 'drizzle-orm';
import { habitLogs, userBlocks } from '../db/schema';

describe('POST /api/habitlogs', () => {
  let handler: any;
  let userA: any;
  let userB: any;
  let habitA: any;
  let habitB: any;

  beforeAll(async () => {
    handler = (await import('../api/habitlogs/index')).default;
    userA = await createTestUser(`a_${Date.now()}`, `a_${Date.now()}@ex.com`);
    userB = await createTestUser(`b_${Date.now()}`, `b_${Date.now()}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Habit A');
    habitB = await createTestHabit(userB.id, 'Habit B');
  });

  afterAll(async () => {
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (habitB?.id) await deleteTestHabit(habitB.id);
    if (userA?.id) await deleteTestUser(userA.id);
    if (userB?.id) await deleteTestUser(userB.id);
  });

  it('should prevent User B from overwriting User A log via explicit ID (PRR-1, PRR-3)', async () => {
    const dateStr = formatISO(new Date(), { representation: 'date' });
    const logAId = `test_hlog_a_${Date.now()}`;
    
    // User A logs
    const eventA = createMockEvent(userA.id, {
      id: logAId,
      habitId: habitA.id,
      date: dateStr,
      status: 'completed'
    }, {}, {}, {}, 'POST');
    await handler(eventA);

    // User B attempts overwrite
    const eventB = createMockEvent(userB.id, {
      id: logAId,
      habitId: habitB.id,
      date: dateStr,
      status: 'failed'
    }, {}, {}, {}, 'POST');

    try {
      await handler(eventB);
    } catch (e) {}

    // Verify User A's log
    const getEventA = createMockEvent(userA.id, {}, {}, {}, {}, 'GET');
    const logsA = (await handler(getEventA)) as any;
    
    const targetLog = logsA.data.find((l: any) => l.id === logAId);
    expect(targetLog).toBeDefined();
    expect(targetLog.status).toBe('completed');
  }, 15000);

  it('should filter blocked recipients from habit log sharedWith', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    await db.insert(userBlocks).values({
      blockerId: userB.id,
      blockedId: userA.id,
      createdAt: new Date()
    });

    const dateStr = formatISO(new Date(), { representation: 'date' });
    const logId = `blocked_hlog_${Date.now()}`;
    const event = createMockEvent(userA.id, {
      id: logId,
      habitId: habitA.id,
      date: dateStr,
      status: 'completed',
      sharedWith: [userB.id]
    }, {}, {}, {}, 'POST');

    await handler(event);

    const [log] = await db.select({ sharedWith: habitLogs.sharedWith })
      .from(habitLogs)
      .where(eq(habitLogs.id, logId));
    expect(log?.sharedWith ?? []).not.toContain(userB.id);
  }, 15000);
});
