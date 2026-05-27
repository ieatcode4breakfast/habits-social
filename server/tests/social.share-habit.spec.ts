import './setup';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, createTestUser, deleteTestUser, createMockEvent, createTestHabit, deleteTestHabit, createFriendship, deleteFriendship } from './test.utils';
import { habits } from '../db/schema';

type ShareHabitResponse = {
  data: {
    success: boolean;
    alreadyShared: boolean;
  };
};

describe('POST /api/social/share-habit', () => {
  let handler: (event: ReturnType<typeof createMockEvent>) => Promise<ShareHabitResponse>;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let userC: Awaited<ReturnType<typeof createTestUser>>;
  let userD: Awaited<ReturnType<typeof createTestUser>>;
  let habitA: Awaited<ReturnType<typeof createTestHabit>>;
  let habitB: Awaited<ReturnType<typeof createTestHabit>>;
  let acceptedFriendshipId: string;
  let pendingFriendshipId: string;
  let crossFriendshipId: string;

  beforeEach(async () => {
    handler = (await import('../api/social/share-habit.post')).default;
    const suffix = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`sha_a_${suffix}`, `sha_a_${suffix}@ex.com`);
    userB = await createTestUser(`sha_b_${suffix}`, `sha_b_${suffix}@ex.com`);
    userC = await createTestUser(`sha_c_${suffix}`, `sha_c_${suffix}@ex.com`);
    userD = await createTestUser(`sha_d_${suffix}`, `sha_d_${suffix}@ex.com`);
    habitA = await createTestHabit(userA.id, 'Append Share A');
    habitB = await createTestHabit(userA.id, 'Append Share B');

    const accepted = await createFriendship(userA.id, userB.id, 'accepted');
    const pending = await createFriendship(userA.id, userC.id, 'pending');
    const cross = await createFriendship(userB.id, userC.id, 'accepted');
    acceptedFriendshipId = accepted.id;
    pendingFriendshipId = pending.id;
    crossFriendshipId = cross.id;
  });

  afterEach(async () => {
    if (crossFriendshipId) await deleteFriendship(crossFriendshipId);
    if (pendingFriendshipId) await deleteFriendship(pendingFriendshipId);
    if (acceptedFriendshipId) await deleteFriendship(acceptedFriendshipId);
    if (habitB?.id) await deleteTestHabit(habitB.id);
    if (habitA?.id) await deleteTestHabit(habitA.id);
    if (userD?.id) await deleteTestUser(userD.id);
    if (userC?.id) await deleteTestUser(userC.id);
    if (userB?.id) await deleteTestUser(userB.id);
    if (userA?.id) await deleteTestUser(userA.id);
  });

  it('adds an accepted friend to one habit sharedWith array', async () => {
    const event = createMockEvent(userA.id, {
      targetUserId: userB.id,
      habitId: habitA.id,
      userDate: '2026-05-27'
    }, {}, {}, {}, 'POST');

    const response = await handler(event);
    expect(response.data).toEqual({ success: true, alreadyShared: false });

    const [updated] = await db.select({ sharedWith: habits.sharedWith })
      .from(habits)
      .where(eq(habits.id, habitA.id));
    expect(updated?.sharedWith ?? []).toContain(userB.id);
  });

  it('does not remove other habits already shared with the same friend', async () => {
    await db.update(habits)
      .set({ sharedWith: [userB.id] })
      .where(eq(habits.id, habitB.id));

    const event = createMockEvent(userA.id, {
      targetUserId: userB.id,
      habitId: habitA.id
    }, {}, {}, {}, 'POST');

    await handler(event);

    const rows = await db.select({ id: habits.id, sharedWith: habits.sharedWith })
      .from(habits)
      .where(eq(habits.ownerId, userA.id));

    const firstHabit = rows.find((habit) => habit.id === habitA.id);
    const secondHabit = rows.find((habit) => habit.id === habitB.id);
    expect(firstHabit?.sharedWith ?? []).toContain(userB.id);
    expect(secondHabit?.sharedWith ?? []).toContain(userB.id);
  });

  it('is idempotent and does not duplicate an existing recipient', async () => {
    const body = {
      targetUserId: userB.id,
      habitId: habitA.id
    };

    await handler(createMockEvent(userA.id, body, {}, {}, {}, 'POST'));
    const secondResponse = await handler(createMockEvent(userA.id, body, {}, {}, {}, 'POST'));

    const [updated] = await db.select({ sharedWith: habits.sharedWith })
      .from(habits)
      .where(eq(habits.id, habitA.id));
    const shareCount = (updated?.sharedWith ?? []).filter((id) => id === userB.id).length;

    expect(secondResponse.data).toEqual({ success: true, alreadyShared: true });
    expect(shareCount).toBe(1);
  });

  it('rejects non-friends and pending-only friendships', async () => {
    await expect(handler(createMockEvent(userA.id, {
      targetUserId: userD.id,
      habitId: habitA.id
    }, {}, {}, {}, 'POST'))).rejects.toMatchObject({ statusCode: 403 });

    await expect(handler(createMockEvent(userA.id, {
      targetUserId: userC.id,
      habitId: habitA.id
    }, {}, {}, {}, 'POST'))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('does not let a user share a habit they do not own', async () => {
    await expect(handler(createMockEvent(userB.id, {
      targetUserId: userC.id,
      habitId: habitA.id
    }, {}, {}, {}, 'POST'))).rejects.toMatchObject({ statusCode: 404 });
  });
});
