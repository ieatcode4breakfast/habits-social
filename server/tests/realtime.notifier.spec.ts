import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ChatService } from '../services/chat.service';
import { SocialService } from '../services/social.service';
import * as schema from '../db/schema';
import { useDB } from '../utils/db';
import {
  createFriendship,
  createMockEvent,
  createTestUser,
  deleteTestUser,
} from './test.utils';
import * as realtimeNotifier from '../utils/realtimeNotifier';

describe('realtime notifier wiring', () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`rt_a_${id}`, `rt_a_${id}@ex.com`);
    userB = await createTestUser(`rt_b_${id}`, `rt_b_${id}@ex.com`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it('notifies both users after a committed chat send', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    const notify = vi.spyOn(realtimeNotifier, 'notifyUsersRealtime').mockResolvedValue();

    const conversation = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
    await ChatService.sendMessage(useDB(), userA.id, conversation.id, 'hello');

    expect(notify).toHaveBeenCalledWith([userA.id, userB.id], { type: 'chat.changed' });
  });

  it('notifies both users after a committed message tombstone', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    const conversation = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
    const message = await ChatService.sendMessage(useDB(), userA.id, conversation.id, 'delete me');
    const notify = vi.spyOn(realtimeNotifier, 'notifyUsersRealtime').mockResolvedValue();

    await ChatService.deleteMessage(useDB(), userA.id, message.id);

    expect(notify).toHaveBeenCalledWith([userA.id, userB.id], { type: 'chat.changed' });
  });

  it('notifies requester and receiver after creating, accepting, and removing friendships', async () => {
    const notify = vi.spyOn(realtimeNotifier, 'notifyUsersRealtime').mockResolvedValue();
    const event = createMockEvent(userA.id);

    const friendship = await SocialService.createFriendship(useDB(), userA.id, userB.id, event);
    expect(notify).toHaveBeenLastCalledWith([userA.id, userB.id], { type: 'friends.changed' });

    await SocialService.acceptFriendship(useDB(), userB.id, friendship.id, event);
    expect(notify).toHaveBeenLastCalledWith([userA.id, userB.id], { type: 'friends.changed' });

    await SocialService.removeFriendship(useDB(), userA.id, friendship.id, event);
    expect(notify).toHaveBeenLastCalledWith([userA.id, userB.id], { type: 'friends.changed' });
  });

  it('does not fail the original action when realtime notification fails', async () => {
    await createFriendship(userA.id, userB.id, 'accepted');
    vi.spyOn(realtimeNotifier, 'notifyUsersRealtime').mockRejectedValue(new Error('PartyKit unavailable'));

    const conversation = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
    await expect(ChatService.sendMessage(useDB(), userA.id, conversation.id, 'still commits')).resolves.toMatchObject({
      body: 'still commits',
    });

    const rows = await useDB()
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, conversation.id));
    expect(rows.some((row) => row.body === 'still commits')).toBe(true);
  });
});

describe('realtime notifier guardrails', () => {
  const runtimeConfig = {
    partykitNotifySecret: 'notify-secret',
    public: {
      realtimeEnabled: true,
      partykitHost: 'habits-social-realtime-staging.test.partykit.dev',
    },
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects more than two recipients before making outbound requests', async () => {
    vi.stubGlobal('useRuntimeConfig', () => runtimeConfig);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      realtimeNotifier.notifyUsersRealtime(
        [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
        { type: 'friends.changed' }
      )
    ).rejects.toThrow(/recipient/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid PartyKit hosts before making outbound requests', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      ...runtimeConfig,
      public: {
        ...runtimeConfig.public,
        partykitHost: 'https://evil.example.com/path',
      },
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      realtimeNotifier.notifyUsersRealtime([crypto.randomUUID()], { type: 'chat.changed' })
    ).rejects.toThrow(/host/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
