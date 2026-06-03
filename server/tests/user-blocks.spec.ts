import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, or } from 'drizzle-orm';
import { ChatService } from '../services/chat.service';
import { SocialService } from '../services/social.service';
import { friendships, userBlocks } from '../db/schema';
import {
  createFriendship,
  createMockEvent,
  createTestUser,
  db,
  deleteTestUser,
  type User
} from './test.utils';
import * as realtimeNotifier from '../utils/realtimeNotifier';

describe('User blocking backend boundaries', () => {
  let userA: User;
  let userB: User;
  let userC: User;

  beforeEach(async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`block_a_${suffix}`, `block_a_${suffix}@ex.com`);
    userB = await createTestUser(`block_b_${suffix}`, `block_b_${suffix}@ex.com`);
    userC = await createTestUser(`block_c_${suffix}`, `block_c_${suffix}@ex.com`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  it('blocks another user and notifies both users', async () => {
    const notify = vi.spyOn(realtimeNotifier, 'notifyUsersRealtime').mockResolvedValue();

    const result = await SocialService.blockUser(db, userA.id, userB.id);

    expect(result.blockerId).toBe(userA.id);
    expect(result.blockedId).toBe(userB.id);
    expect(notify).toHaveBeenCalledWith([userA.id, userB.id], { type: 'friends.changed' });

    const rows = await db.select().from(userBlocks).where(and(
      eq(userBlocks.blockerId, userA.id),
      eq(userBlocks.blockedId, userB.id)
    ));
    expect(rows).toHaveLength(1);
  });

  it('rejects self-blocking', async () => {
    await expect(SocialService.blockUser(db, userA.id, userA.id)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('is idempotent without duplicate block rows', async () => {
    await SocialService.blockUser(db, userA.id, userB.id);
    await SocialService.blockUser(db, userA.id, userB.id);

    const rows = await db.select().from(userBlocks).where(and(
      eq(userBlocks.blockerId, userA.id),
      eq(userBlocks.blockedId, userB.id)
    ));
    expect(rows).toHaveLength(1);
  });

  it('removes accepted friendships when blocking', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');

    await SocialService.blockUser(db, userA.id, userB.id);

    const friendshipRows = await db.select().from(friendships).where(or(
      and(eq(friendships.initiatorId, userA.id), eq(friendships.receiverId, userB.id)),
      and(eq(friendships.initiatorId, userB.id), eq(friendships.receiverId, userA.id))
    ));
    expect(friendshipRows).toHaveLength(0);
  });

  it('removes pending friendships when blocking', async () => {
    await createFriendship(userB.id, userA.id, 'pending');

    await SocialService.blockUser(db, userA.id, userB.id);

    const friendshipRows = await db.select().from(friendships).where(or(
      and(eq(friendships.initiatorId, userA.id), eq(friendships.receiverId, userB.id)),
      and(eq(friendships.initiatorId, userB.id), eq(friendships.receiverId, userA.id))
    ));
    expect(friendshipRows).toHaveLength(0);
  });

  it('unblocks by only removing the block row', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    await SocialService.blockUser(db, userA.id, userB.id);

    const unblocked = await SocialService.unblockUser(db, userA.id, userB.id);

    expect(unblocked).toBe(true);

    const blockRows = await db.select().from(userBlocks).where(and(
      eq(userBlocks.blockerId, userA.id),
      eq(userBlocks.blockedId, userB.id)
    ));
    expect(blockRows).toHaveLength(0);

    const friendshipRows = await db.select().from(friendships).where(or(
      and(eq(friendships.initiatorId, userA.id), eq(friendships.receiverId, userB.id)),
      and(eq(friendships.initiatorId, userB.id), eq(friendships.receiverId, userA.id))
    ));
    expect(friendshipRows).toHaveLength(0);
  });

  it('prevents a blocked user from finding the blocker in search', async () => {
    const searchHandler = (await import('../api/users/search.get')).default;
    await SocialService.blockUser(db, userA.id, userB.id);

    const event = createMockEvent(userB.id, {}, {}, {}, { username: userA.username });
    const response = await searchHandler(event) as { data: Array<{ id: string }> };

    expect(response.data.find((user) => user.id === userA.id)).toBeUndefined();
  });

  it('allows the blocker to find the blocked user in search', async () => {
    const searchHandler = (await import('../api/users/search.get')).default;
    await SocialService.blockUser(db, userA.id, userB.id);

    const event = createMockEvent(userA.id, {}, {}, {}, { username: userB.username });
    const response = await searchHandler(event) as { data: Array<{ id: string; blockedByMe?: boolean }> };

    const found = response.data.find((user) => user.id === userB.id);
    expect(found).toBeDefined();
    expect(found?.blockedByMe).toBe(true);
  });

  it('keeps unrelated matching users searchable', async () => {
    const searchHandler = (await import('../api/users/search.get')).default;
    await SocialService.blockUser(db, userA.id, userB.id);

    const event = createMockEvent(userB.id, {}, {}, {}, { username: userC.username });
    const response = await searchHandler(event) as { data: Array<{ id: string }> };

    expect(response.data.find((user) => user.id === userC.id)).toBeDefined();
  });

  it('prevents friendship creation when requester blocked target', async () => {
    const friendshipHandler = (await import('../api/friendships/index')).default;
    await SocialService.blockUser(db, userA.id, userB.id);

    const event = createMockEvent(userA.id, { targetUserId: userB.id }, {}, {}, {}, 'POST');

    await expect(friendshipHandler(event)).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('prevents friendship creation when target blocked requester', async () => {
    const friendshipHandler = (await import('../api/friendships/index')).default;
    await SocialService.blockUser(db, userA.id, userB.id);

    const event = createMockEvent(userB.id, { targetUserId: userA.id }, {}, {}, {}, 'POST');

    await expect(friendshipHandler(event)).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('cuts off chat access by removing the friendship', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    const conversation = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
    await ChatService.sendMessage(db, userA.id, conversation.id, 'before block');

    await SocialService.blockUser(db, userA.id, userB.id);

    const conversations = await ChatService.listConversations(db, userA.id);
    expect(conversations.find((item) => item.id === conversation.id)).toBeUndefined();
    await expect(ChatService.listMessages(db, userA.id, conversation.id)).rejects.toThrow(/Active friendship required/i);
    await expect(ChatService.sendMessage(db, userB.id, conversation.id, 'after block')).rejects.toThrow(/Active friendship required/i);
  });

  it('exposes authenticated block and unblock endpoints', async () => {
    const blockHandler = (await import('../api/users/[id]/block')).default;

    const blockEvent = createMockEvent(userA.id, {}, {}, { id: userB.id }, {}, 'POST');
    const blockResponse = await blockHandler(blockEvent) as { data: { blocked: boolean } };
    expect(blockResponse.data.blocked).toBe(true);

    const unblockEvent = createMockEvent(userA.id, {}, {}, { id: userB.id }, {}, 'DELETE');
    const unblockResponse = await blockHandler(unblockEvent) as { data: { blocked: boolean } };
    expect(unblockResponse.data.blocked).toBe(false);
  });
});
