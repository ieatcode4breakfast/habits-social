import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref, type Ref } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import InboxPage from './inbox.vue';

const mockInitSocial = vi.fn();
const mockRefreshSocial = vi.fn();
const mockShowToast = vi.fn();
const { stateStore, useNuxtAppMock, useStateMock } = vi.hoisted(() => {
  const stateStore = new Map<string, Ref<unknown>>();
  const useNuxtAppMock = vi.fn(() => ({
    payload: { state: {} },
    runWithContext: (fn: () => unknown) => fn()
  }));

  const useStateMock = <T,>(key: string, init: () => T): Ref<T> => {
    if (!stateStore.has(key)) {
      stateStore.set(key, { value: init() } as Ref<unknown>);
    }
    return stateStore.get(key) as Ref<T>;
  };

  return { stateStore, useNuxtAppMock, useStateMock };
});

const friendProfile = {
  id: 'friend-1',
  email: 'friend@example.com',
  username: 'Alex',
  photoUrl: ''
};

const activeConversation = {
  id: 'conv-1',
  user1Id: 'user-1',
  user2Id: friendProfile.id,
  unreadCount: 1,
  lastMessageAt: '2026-05-20T10:00:00.000Z',
  lastMessageBody: 'Latest message preview that should render in one line',
  lastMessageDeletedAt: null,
  lastMessageSenderId: friendProfile.id
};

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
}

interface MessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  cursor: string | null;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number>;
}

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

vi.mock('#imports', async () => {
  const actual = await vi.importActual<typeof import('#imports')>('#imports');

  return {
    ...actual,
    definePageMeta: vi.fn(),
    useHead: vi.fn(),
    useSeoMeta: vi.fn(),
    useServerSeoMeta: vi.fn(),
    useState: useStateMock,
    usePullToRefresh: () => ({
      isPulling: ref(false),
      isRefreshing: ref(false)
    })
  };
});

vi.mock('#app', () => ({
  useState: useStateMock,
  useNuxtApp: useNuxtAppMock,
  useRequestHeaders: vi.fn(() => ({})),
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
  definePageMeta: vi.fn()
}));

vi.mock('nuxt/app', () => ({
  useState: useStateMock,
  useNuxtApp: useNuxtAppMock,
  useRequestHeaders: vi.fn(() => ({})),
  useSeoMeta: vi.fn(),
  useHead: vi.fn(),
  definePageMeta: vi.fn()
}));

vi.mock('#app/composables/state', () => ({
  useState: useStateMock
}));

vi.stubGlobal('useState', useStateMock);
vi.stubGlobal('useNuxtApp', useNuxtAppMock);

vi.mock('#app/composables/head', () => ({
  injectHead: vi.fn(),
  useHead: vi.fn(),
  useHeadSafe: vi.fn(),
  useSeoMeta: vi.fn(),
  useServerHead: vi.fn(),
  useServerHeadSafe: vi.fn(),
  useServerSeoMeta: vi.fn()
}));

vi.mock('~/composables/useAuth', () => ({
  useAuth: () => ({
    user: ref({
      id: 'user-1',
      email: 'me@example.com',
      username: 'Me',
      photoUrl: ''
    })
  })
}));

vi.mock('~/composables/useSocial', () => ({
  useSocial: () => ({
    friends: ref([friendProfile]),
    profilesMap: ref({
      [friendProfile.id]: friendProfile
    }),
    init: mockInitSocial,
    refresh: mockRefreshSocial
  })
}));

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast
  })
}));

vi.mock('~/composables/useChatInbox', async () => {
  const { computed, ref } = await vi.importActual<typeof import('vue')>('vue');
  const conversations = ref<Array<{
    id: string;
    user1Id: string;
    user2Id: string;
    unreadCount: number;
    lastMessageAt: string | null;
    lastMessageBody: string | null;
    lastMessageDeletedAt: string | null;
    lastMessageSenderId: string | null;
  }>>([]);
  const isLoading = ref(false);

  return {
    useChatInbox: () => ({
      conversations,
      isLoading,
      totalUnreadCount: computed(() =>
        conversations.value.reduce((total, conversation) => total + Math.max(0, conversation.unreadCount), 0)
      ),
      refresh: async (silent = false, preserveLoading = false) => {
        if (!silent) isLoading.value = true;
        try {
          conversations.value = await (globalThis as {
            $fetch: (url: string) => Promise<typeof conversations.value>;
          }).$fetch('/api/chat/conversations');
        } finally {
          if (!preserveLoading) isLoading.value = false;
        }
      },
      markConversationReadLocally: (conversationId: string) => {
        conversations.value = conversations.value.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        );
      }
    })
  };
});

describe('Inbox conversation refresh icon', () => {
  let wrapper: VueWrapper<unknown> | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;
  let initialMessages: Deferred<MessagesResponse>;
  let olderMessages: Deferred<MessagesResponse>;
  let sentMessage: Deferred<ChatMessage>;
  let messageRequestCount = 0;

  const mountPage = () =>
    mount(InboxPage, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

  const getRootShell = () => {
    const shell = wrapper?.element as HTMLElement | undefined;
    if (!shell) {
      throw new Error('Expected inbox shell to render');
    }
    return shell;
  };

  const getConversationButton = () => {
    const button = wrapper?.findAll('button').find((candidate) => candidate.text().includes('Alex'));
    if (!button) {
      throw new Error('Expected conversation button to render');
    }
    return button;
  };

  const getLoadOlderButton = () => {
    const button = wrapper?.findAll('button').find((candidate) => candidate.text().includes('Load older messages'));
    if (!button) {
      throw new Error('Expected load older messages button to render');
    }
    return button;
  };

  const getMessageTextarea = () => {
    const textarea = wrapper?.find('textarea');
    if (!textarea?.exists()) {
      throw new Error('Expected message textarea to render');
    }
    return textarea;
  };

  const getSendButtonElement = () => {
    const textarea = getMessageTextarea().element;
    const button = textarea.parentElement?.querySelector('button');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Expected send button to render');
    }
    return button;
  };

  const openActiveConversation = async () => {
    await getConversationButton().trigger('click');
    await nextTick();
  };

  beforeEach(async () => {
    document.body.innerHTML = '';
    stateStore.clear();
    mockInitSocial.mockReset();
    mockRefreshSocial.mockReset();
    mockShowToast.mockReset();
    messageRequestCount = 0;

    initialMessages = createDeferred<MessagesResponse>();
    olderMessages = createDeferred<MessagesResponse>();
    sentMessage = createDeferred<ChatMessage>();

    fetchMock = vi.fn(async (url: string, options?: FetchOptions) => {
      if (url === '/api/chat/conversations') {
        return [
          activeConversation
        ];
      }

      if (
        url === `/api/chat/conversations/by-friend/${friendProfile.id}/messages`
        && options?.method === 'POST'
      ) {
        return sentMessage.promise;
      }

      if (url === `/api/chat/conversations/${activeConversation.id}/read`) {
        return {};
      }

      if (url === `/api/chat/conversations/${activeConversation.id}/messages`) {
        messageRequestCount += 1;

        if (messageRequestCount === 1) return initialMessages.promise;
        if (messageRequestCount === 2) return olderMessages.promise;
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    vi.stubGlobal('$fetch', fetchMock);

    wrapper = mountPage();
    await flushPromises();
    await nextTick();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the shared padding contract while using a sm-only full-bleed inbox shell', async () => {
    const shellClasses = getRootShell().className.split(/\s+/);

    expect(shellClasses).toContain('sm:-mx-6');
    expect(shellClasses).toContain('md:mx-0');
  });

  it('shows the latest message as a bold one-line preview when unread', async () => {
    const preview = getConversationButton().findAll('span').find((span) =>
      span.text() === 'Latest message preview that should render in one line'
    );

    expect(preview?.exists()).toBe(true);
    expect(preview?.classes()).toContain('truncate');
    expect(preview?.classes()).toContain('font-bold');
    expect(wrapper?.text()).not.toContain('Click to view messages');
  });

  it('prefixes the latest preview with You when the current user sent it', async () => {
    fetchMock.mockImplementation(async (url: string, options?: FetchOptions) => {
      if (url === '/api/chat/conversations') {
        return [
          {
            ...activeConversation,
            unreadCount: 0,
            lastMessageBody: 'My latest message',
            lastMessageSenderId: 'user-1'
          }
        ];
      }

      if (
        url === `/api/chat/conversations/by-friend/${friendProfile.id}/messages`
        && options?.method === 'POST'
      ) {
        return sentMessage.promise;
      }

      if (url === `/api/chat/conversations/${activeConversation.id}/read`) return {};
      if (url === `/api/chat/conversations/${activeConversation.id}/messages`) return initialMessages.promise;

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    wrapper?.unmount();
    wrapper = mountPage();
    await flushPromises();
    await nextTick();

    expect(getConversationButton().text()).toContain('You: My latest message');
  });

  it('shows a sent message optimistically and keeps the send button icon static while the request is pending', async () => {
    await openActiveConversation();

    await getMessageTextarea().setValue('Hello optimistically');
    getSendButtonElement().click();
    await nextTick();

    expect(wrapper?.text()).toContain('Hello optimistically');
    expect(getMessageTextarea().element.value).toBe('');
    expect(getSendButtonElement().disabled).toBe(true);
    expect(getSendButtonElement().querySelector('.animate-spin')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/chat/conversations/by-friend/${friendProfile.id}/messages`,
      {
        method: 'POST',
        body: { body: 'Hello optimistically' }
      }
    );
  });

  it('sends optimistically when crypto.randomUUID is unavailable on physical mobile dev contexts', async () => {
    await openActiveConversation();

    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint32Array<ArrayBuffer>): Uint32Array<ArrayBuffer> => {
        array[0] = 123;
        array[1] = 456;
        return array;
      }
    });

    await getMessageTextarea().setValue('Mobile fallback send');
    getSendButtonElement().click();
    await nextTick();

    expect(wrapper?.text()).toContain('Mobile fallback send');
    expect(getMessageTextarea().element.value).toBe('');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/chat/conversations/by-friend/${friendProfile.id}/messages`,
      {
        method: 'POST',
        body: { body: 'Mobile fallback send' }
      }
    );
  });

  it('replaces the optimistic message with the committed server message without duplicating it', async () => {
    await openActiveConversation();

    await getMessageTextarea().setValue('Replace me');
    getSendButtonElement().click();
    await nextTick();

    sentMessage.resolve({
      id: 'message-server-1',
      conversationId: activeConversation.id,
      senderId: 'user-1',
      body: 'Replace me',
      createdAt: '2026-05-20T10:01:00.000Z',
      deletedAt: null
    });

    await flushPromises();
    await nextTick();

    const exactBodySpans = wrapper?.findAll('span').filter((span) => span.text() === 'Replace me') || [];
    expect(exactBodySpans).toHaveLength(1);
  });

  it('removes the optimistic message and restores the draft when sending fails before the user types again', async () => {
    await openActiveConversation();

    await getMessageTextarea().setValue('Please survive failure');
    getSendButtonElement().click();
    await nextTick();

    sentMessage.reject({ statusCode: 429 });

    await flushPromises();
    await nextTick();

    expect(wrapper?.text()).not.toContain('Please survive failure');
    expect(getMessageTextarea().element.value).toBe('Please survive failure');
    expect(mockShowToast).toHaveBeenCalledWith('Rate limit exceeded. Please wait a moment.', 'failed');
  });

  it('preserves multiline message bodies including blank lines', async () => {
    await openActiveConversation();

    initialMessages.resolve({
      messages: [
        {
          id: 'multiline-message',
          conversationId: activeConversation.id,
          senderId: friendProfile.id,
          body: 'Line 1\n\nLine 2',
          createdAt: '2026-05-20T10:01:00.000Z',
          deletedAt: null
        }
      ],
      hasMore: false,
      cursor: null
    });

    await flushPromises();
    await nextTick();

    const multilineSpan = wrapper?.findAll('span').find((span) => span.text() === 'Line 1\n\nLine 2');
    expect(multilineSpan?.exists()).toBe(true);
    expect(multilineSpan?.classes()).toContain('whitespace-pre-wrap');
  });

  it('shows one avatar on the bottom-most message of each sender turn', async () => {
    await openActiveConversation();

    initialMessages.resolve({
      messages: [
        {
          id: 'own-newest',
          conversationId: activeConversation.id,
          senderId: 'user-1',
          body: 'Own newest',
          createdAt: '2026-05-20T10:04:00.000Z',
          deletedAt: null
        },
        {
          id: 'own-older',
          conversationId: activeConversation.id,
          senderId: 'user-1',
          body: 'Own older',
          createdAt: '2026-05-20T10:03:00.000Z',
          deletedAt: null
        },
        {
          id: 'friend-newest',
          conversationId: activeConversation.id,
          senderId: friendProfile.id,
          body: 'Friend newest',
          createdAt: '2026-05-20T10:02:00.000Z',
          deletedAt: null
        },
        {
          id: 'friend-older',
          conversationId: activeConversation.id,
          senderId: friendProfile.id,
          body: 'Friend older',
          createdAt: '2026-05-20T10:01:00.000Z',
          deletedAt: null
        }
      ],
      hasMore: false,
      cursor: null
    });

    await flushPromises();
    await nextTick();

    const visibleAvatars = wrapper?.findAll('[data-testid="message-avatar"]') || [];
    expect(visibleAvatars).toHaveLength(2);
    expect(visibleAvatars.map((avatar) => avatar.text())).toEqual(expect.arrayContaining(['M', 'A']));
  });

  it('formats sub-minute past and future message timestamps as just now', async () => {
    await openActiveConversation();
    const now = Date.now();

    initialMessages.resolve({
      messages: [
        {
          id: 'future-message',
          conversationId: activeConversation.id,
          senderId: friendProfile.id,
          body: 'Future clock skew',
          createdAt: new Date(now + 30_000).toISOString(),
          deletedAt: null
        },
        {
          id: 'past-message',
          conversationId: activeConversation.id,
          senderId: friendProfile.id,
          body: 'Past recent message',
          createdAt: new Date(now - 30_000).toISOString(),
          deletedAt: null
        }
      ],
      hasMore: false,
      cursor: null
    });

    await flushPromises();
    await nextTick();

    expect(wrapper?.text()).toContain('Future clock skew');
    expect(wrapper?.text()).toContain('Past recent message');
    expect(wrapper?.text()).not.toContain('in less than a minute');
    const justNowTimestamps = wrapper?.findAll('span').filter((span) => span.text() === 'just now') || [];
    expect(justNowTimestamps).toHaveLength(2);
  });
});
