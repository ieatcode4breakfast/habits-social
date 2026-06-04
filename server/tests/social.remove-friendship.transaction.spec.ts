import './setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  createFriendship,
  createTestHabit,
  createTestUser,
  db,
  deleteFriendship,
  deleteTestHabit,
  deleteTestUser,
  shareHabitWithUser,
  type Friendship,
  type Habit,
  type User
} from './test.utils';
import { SocialService } from '../services/social.service';
import { friendships, habitLogs, habits } from '../db/schema';

type RemovalFixture = {
  userA: User;
  userB: User;
  friendship: Friendship;
  habitA: Habit;
  habitB: Habit;
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

  return {
    userA,
    userB,
    friendship,
    habitA,
    habitB
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

  const habitA = await db.select().from(habits).where(eq(habits.id, data.habitA.id));
  const habitB = await db.select().from(habits).where(eq(habits.id, data.habitB.id));
  expect(habitA[0]?.sharedWith).toContain(data.userB.id);
  expect(habitB[0]?.sharedWith).toContain(data.userA.id);

  const logA = await db.select().from(habitLogs).where(eq(habitLogs.id, `${data.habitA.id}_${testDate}`));
  const logB = await db.select().from(habitLogs).where(eq(habitLogs.id, `${data.habitB.id}_${testDate}`));
  expect(logA[0]?.sharedWith).toContain(data.userB.id);
  expect(logB[0]?.sharedWith).toContain(data.userA.id);
}

async function cleanupFixture(data: RemovalFixture | null) {
  if (!data) return;

  await deleteFriendship(data.friendship.id);
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

    const habitA = await db.select().from(habits).where(eq(habits.id, fixture.habitA.id));
    const habitB = await db.select().from(habits).where(eq(habits.id, fixture.habitB.id));
    expect(habitA[0]?.sharedWith).not.toContain(fixture.userB.id);
    expect(habitB[0]?.sharedWith).not.toContain(fixture.userA.id);

    const logA = await db.select().from(habitLogs).where(eq(habitLogs.id, `${fixture.habitA.id}_${testDate}`));
    const logB = await db.select().from(habitLogs).where(eq(habitLogs.id, `${fixture.habitB.id}_${testDate}`));
    expect(logA[0]?.sharedWith).not.toContain(fixture.userB.id);
    expect(logB[0]?.sharedWith).not.toContain(fixture.userA.id);
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
