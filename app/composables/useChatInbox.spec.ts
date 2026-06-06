import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';

const fetchMock = vi.fn();
const stateStore = new Map<string, Ref<unknown>>();
const isOnlineRef = ref(true);

const useStateMock = <T>(key: string, init: () => T): Ref<T> => {
  if (!stateStore.has(key)) {
    stateStore.set(key, ref(init()));
  }
  return stateStore.get(key) as Ref<T>;
};

vi.mock('#app', () => ({
  useState: useStateMock,
}));

vi.mock('nuxt/app', () => ({
  useState: useStateMock,
}));

vi.mock('#app/composables/state', () => ({
  useState: useStateMock,
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    user: ref({ id: 'user-1', email: 'u@example.com', username: 'user' }),
  }),
}));

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: isOnlineRef })
}));

vi.stubGlobal('$fetch', fetchMock);

describe('useChatInbox', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    stateStore.clear();
    isOnlineRef.value = true;
  });

  it('refreshes shared conversations and derives the total unread count', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'conversation-1',
        lastMessageAt: '2026-05-22T10:00:00.000Z',
        lastMessageBody: 'Unread preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-2',
        user1Id: 'user-1',
        user2Id: 'user-2',
        unreadCount: 2,
      },
      {
        id: 'conversation-2',
        lastMessageAt: '2026-05-22T11:00:00.000Z',
        lastMessageBody: 'Read preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-1',
        user1Id: 'user-1',
        user2Id: 'user-3',
        unreadCount: 3,
      },
    ]);

    const { useChatInbox } = await import('./useChatInbox');
    const inbox = useChatInbox();

    await inbox.refresh();

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations');
    expect(inbox.conversations.value).toHaveLength(2);
    expect(inbox.conversations.value[0]?.lastMessageBody).toBe('Unread preview');
    expect(inbox.conversations.value[1]?.lastMessageSenderId).toBe('user-1');
    expect(inbox.totalUnreadCount.value).toBe(5);
  });

  it('does not fetch conversations while offline', async () => {
    isOnlineRef.value = false;

    const { useChatInbox } = await import('./useChatInbox');
    const inbox = useChatInbox();

    await inbox.refresh();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(inbox.conversations.value).toEqual([]);
  });

  it('clears one conversation locally after it is marked read', async () => {
    const { useChatInbox } = await import('./useChatInbox');
    const inbox = useChatInbox();
    inbox.conversations.value = [
      {
        id: 'conversation-1',
        lastMessageAt: null,
        lastMessageBody: 'Unread preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-2',
        user1Id: 'user-1',
        user2Id: 'user-2',
        unreadCount: 4,
      },
      {
        id: 'conversation-2',
        lastMessageAt: null,
        lastMessageBody: 'Read preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-3',
        user1Id: 'user-1',
        user2Id: 'user-3',
        unreadCount: 1,
      },
    ];

    inbox.markConversationReadLocally('conversation-1');

    expect(inbox.conversations.value.find((conversation) => conversation.id === 'conversation-1')?.unreadCount).toBe(0);
    expect(inbox.totalUnreadCount.value).toBe(1);
  });

  it('clears shared chat state on logout cleanup', async () => {
    const { useChatInbox } = await import('./useChatInbox');
    const inbox = useChatInbox();
    inbox.conversations.value = [
      {
        id: 'conversation-1',
        lastMessageAt: null,
        lastMessageBody: 'Preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-2',
        user1Id: 'user-1',
        user2Id: 'user-2',
        unreadCount: 1,
      },
    ];
    inbox.isLoading.value = true;

    inbox.logoutCleanup();

    expect(inbox.conversations.value).toEqual([]);
    expect(inbox.isLoading.value).toBe(false);
    expect(inbox.totalUnreadCount.value).toBe(0);
  });
});
