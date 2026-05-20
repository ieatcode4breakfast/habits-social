import './setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  createFriendship,
  createTestBucket,
  createTestHabit,
  createTestUser,
  db,
  deleteFriendship,
  deleteTestBucket,
  deleteTestHabit,
  deleteTestUser,
  shareHabitWithUser,
  type Bucket,
  type Friendship,
  type Habit,
  type User
} from './test.utils';
import { SocialService } from '../services/social.service';
import * as bucketsUtils from '../utils/buckets';
import { bucketHabits, bucketLogs, buckets, friendships, habitLogs, habits } from '../db/schema';

type RemovalFixture = {
  userA: User;
  userB: User;
  friendship: Friendship;
  habitA: Habit;
  habitB: Habit;
  bucketA: Bucket;
  bucketB: Bucket;
  bucketLogAId: string;
  bucketLogBId: string;
};

let fixture: RemovalFixture | null = null;

const testDate = '2024-01-01';

async function createRemovalFixture(): Promise<RemovalFixture> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const userA = await createTestUser(`rm_a_${suffix}`, `rm_a_${suffix}@ex.com`);
  const userB = await createTestUser(`rm_b_${suffix}`, `rm_b_${suffix}@ex.com`);
  const friendship = await createFriendship(userA.id, userB.id, 'accepted');

  const habitA = await createTestHabit(userA.id, 'User A shared habit');
  const habitB = await createTestHabit(userB.id, 'User B shared habit');
  await shareHabitWithUser(habitA.id, userB.id);
  await shareHabitWithUser(habitB.id, userA.id);

  const bucketA = await createTestBucket(userA.id, 'User A bucket');
  const bucketB = await createTestBucket(userB.id, 'User B bucket');

  await db.insert(bucketHabits).values([
    {
      bucketId: bucketB.id,
      habitId: habitA.id,
      addedBy: userB.id,
      approvalStatus: 'accepted'
    },
    {
      bucketId: bucketA.id,
      habitId: habitB.id,
      addedBy: userA.id,
      approvalStatus: 'accepted'
    }
  ]);

  await db.insert(habitLogs).values([
    {
      id: `${habitA.id}_${testDate}`,
      habitId: habitA.id,
      ownerId: userA.id,
      date: testDate,
      status: 'completed',
      sharedWith: [userB.id],
      updatedAt: new Date()
    },
    {
      id: `${habitB.id}_${testDate}`,
      habitId: habitB.id,
      ownerId: userB.id,
      date: testDate,
      status: 'completed',
      sharedWith: [userA.id],
      updatedAt: new Date()
    }
  ]);

  await db.update(buckets)
    .set({ currentStreak: 7, longestStreak: 7, streakAnchorDate: testDate })
    .where(eq(buckets.id, bucketA.id));
  await db.update(buckets)
    .set({ currentStreak: 7, longestStreak: 7, streakAnchorDate: testDate })
    .where(eq(buckets.id, bucketB.id));

  const bucketLogAId = `${bucketA.id}_${testDate}_${userA.id}`;
  const bucketLogBId = `${bucketB.id}_${testDate}_${userB.id}`;
  await db.insert(bucketLogs).values([
    {
      id: bucketLogAId,
      bucketId: bucketA.id,
      ownerId: userA.id,
      date: testDate,
      status: 'completed',
      streakCount: 7,
      brokenStreakCount: 0,
      updatedAt: new Date()
    },
    {
      id: bucketLogBId,
      bucketId: bucketB.id,
      ownerId: userB.id,
      date: testDate,
      status: 'completed',
      streakCount: 7,
      brokenStreakCount: 0,
      updatedAt: new Date()
    }
  ]);

  return {
    userA,
    userB,
    friendship,
    habitA,
    habitB,
    bucketA,
    bucketB,
    bucketLogAId,
    bucketLogBId
  };
}

async function expectFriendshipExists(friendshipId: string) {
  const rows = await db.select().from(friendships).where(eq(friendships.id, friendshipId));
  expect(rows).toHaveLength(1);
}

async function expectFriendshipDeleted(friendshipId: string) {
  const rows = await db.select().from(friendships).where(eq(friendships.id, friendshipId));
  expect(rows).toHaveLength(0);
}

async function expectRollbackState(data: RemovalFixture) {
  await expectFriendshipExists(data.friendship.id);

  const bucketBH = await db.select().from(bucketHabits)
    .where(and(eq(bucketHabits.bucketId, data.bucketB.id), eq(bucketHabits.habitId, data.habitA.id)));
  const bucketAH = await db.select().from(bucketHabits)
    .where(and(eq(bucketHabits.bucketId, data.bucketA.id), eq(bucketHabits.habitId, data.habitB.id)));
  expect(bucketBH[0]?.approvalStatus).toBe('accepted');
  expect(bucketAH[0]?.approvalStatus).toBe('accepted');

  const habitA = await db.select().from(habits).where(eq(habits.id, data.habitA.id));
  const habitB = await db.select().from(habits).where(eq(habits.id, data.habitB.id));
  expect(habitA[0]?.sharedWith).toContain(data.userB.id);
  expect(habitB[0]?.sharedWith).toContain(data.userA.id);

  const logA = await db.select().from(habitLogs).where(eq(habitLogs.id, `${data.habitA.id}_${testDate}`));
  const logB = await db.select().from(habitLogs).where(eq(habitLogs.id, `${data.habitB.id}_${testDate}`));
  expect(logA[0]?.sharedWith).toContain(data.userB.id);
  expect(logB[0]?.sharedWith).toContain(data.userA.id);

  const bucketLogA = await db.select().from(bucketLogs).where(eq(bucketLogs.id, data.bucketLogAId));
  const bucketLogB = await db.select().from(bucketLogs).where(eq(bucketLogs.id, data.bucketLogBId));
  expect(bucketLogA[0]?.status).toBe('completed');
  expect(bucketLogA[0]?.streakCount).toBe(7);
  expect(bucketLogB[0]?.status).toBe('completed');
  expect(bucketLogB[0]?.streakCount).toBe(7);
}

async function cleanupFixture(data: RemovalFixture | null) {
  if (!data) return;

  await deleteFriendship(data.friendship.id);
  await deleteTestBucket(data.bucketA.id);
  await deleteTestBucket(data.bucketB.id);
  await deleteTestHabit(data.habitA.id);
  await deleteTestHabit(data.habitB.id);
  await deleteTestUser(data.userA.id);
  await deleteTestUser(data.userB.id);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupFixture(fixture);
  fixture = null;
});

describe('SocialService.removeFriendship transactional integrity', () => {
  it('removes friendship and all friendship-derived sharing state on success', async () => {
    fixture = await createRemovalFixture();

    const result = await SocialService.removeFriendship(db, fixture.userA.id, fixture.friendship.id, null);
    expect(result).toBe(true);

    await expectFriendshipDeleted(fixture.friendship.id);

    const bucketBH = await db.select().from(bucketHabits)
      .where(and(eq(bucketHabits.bucketId, fixture.bucketB.id), eq(bucketHabits.habitId, fixture.habitA.id)));
    const bucketAH = await db.select().from(bucketHabits)
      .where(and(eq(bucketHabits.bucketId, fixture.bucketA.id), eq(bucketHabits.habitId, fixture.habitB.id)));
    expect(bucketBH[0]?.approvalStatus).toBe('removed');
    expect(bucketAH[0]?.approvalStatus).toBe('removed');

    const habitA = await db.select().from(habits).where(eq(habits.id, fixture.habitA.id));
    const habitB = await db.select().from(habits).where(eq(habits.id, fixture.habitB.id));
    expect(habitA[0]?.sharedWith).not.toContain(fixture.userB.id);
    expect(habitB[0]?.sharedWith).not.toContain(fixture.userA.id);

    const logA = await db.select().from(habitLogs).where(eq(habitLogs.id, `${fixture.habitA.id}_${testDate}`));
    const logB = await db.select().from(habitLogs).where(eq(habitLogs.id, `${fixture.habitB.id}_${testDate}`));
    expect(logA[0]?.sharedWith).not.toContain(fixture.userB.id);
    expect(logB[0]?.sharedWith).not.toContain(fixture.userA.id);

    const bucketLogA = await db.select().from(bucketLogs).where(eq(bucketLogs.id, fixture.bucketLogAId));
    const bucketLogB = await db.select().from(bucketLogs).where(eq(bucketLogs.id, fixture.bucketLogBId));
    expect(bucketLogA).toHaveLength(0);
    expect(bucketLogB).toHaveLength(0);
  }, 60000);

  it('rolls back bucket habit cleanup when bucket reevaluation fails', async () => {
    fixture = await createRemovalFixture();
    vi.spyOn(bucketsUtils, 'reevaluateMultipleBuckets')
      .mockRejectedValueOnce(new Error('SIMULATED_REEVALUATION_FAILURE'));

    await expect(SocialService.removeFriendship(db, fixture.userA.id, fixture.friendship.id, null))
      .rejects.toThrow('SIMULATED_REEVALUATION_FAILURE');

    await expectRollbackState(fixture);
  }, 60000);

  it('rolls back all cleanup when final friendship delete fails', async () => {
    fixture = await createRemovalFixture();
    const originalTransaction = db.transaction.bind(db);

    vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => {
      return await originalTransaction(async (tx: any) => {
        const originalDelete = tx.delete.bind(tx);
        const poisonedTx = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === 'delete') {
              return (table: any) => {
                // This throws during Drizzle delete builder creation, before .where() runs.
                // Any throw from the transaction callback must still roll back prior writes.
                if (table === friendships) {
                  throw new Error('SIMULATED_FRIENDSHIP_DELETE_FAILURE');
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

    await expect(SocialService.removeFriendship(db, fixture.userA.id, fixture.friendship.id, null))
      .rejects.toThrow('SIMULATED_FRIENDSHIP_DELETE_FAILURE');

    await expectRollbackState(fixture);
  }, 60000);

  it('returns false when friendship does not exist', async () => {
    fixture = await createRemovalFixture();

    const result = await SocialService.removeFriendship(db, fixture.userA.id, crypto.randomUUID(), null);
    expect(result).toBe(false);

    await expectRollbackState(fixture);
  }, 60000);
});
