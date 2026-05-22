import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import InboxPage from './inbox.vue';

const mockInitSocial = vi.fn();
const mockRefreshSocial = vi.fn();
const mockShowToast = vi.fn();

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
  lastMessageAt: '2026-05-20T10:00:00.000Z'
};

interface ChatMessage {
  id: string;
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
    usePullToRefresh: () => ({
      isPulling: ref(false),
      isRefreshing: ref(false)
    })
  };
});

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
      username: 'Me'
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

describe('Inbox conversation refresh icon', () => {
  let wrapper: VueWrapper<unknown> | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;
  let initialMessages: Deferred<MessagesResponse>;
  let refreshMessages: Deferred<MessagesResponse>;
  let olderMessages: Deferred<MessagesResponse>;
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

  const getConversationButton = () => {
    const button = wrapper?.findAll('button').find((candidate) => candidate.text().includes('Alex'));
    if (!button) {
      throw new Error('Expected conversation button to render');
    }
    return button;
  };

  const getRefreshButton = () => {
    const button = wrapper?.get('button[title="Refresh conversation"]');
    if (!button) {
      throw new Error('Expected refresh button to render');
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

  beforeEach(async () => {
    document.body.innerHTML = '';
    mockInitSocial.mockReset();
    mockRefreshSocial.mockReset();
    mockShowToast.mockReset();
    messageRequestCount = 0;

    initialMessages = createDeferred<MessagesResponse>();
    refreshMessages = createDeferred<MessagesResponse>();
    olderMessages = createDeferred<MessagesResponse>();

    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/chat/conversations') {
        return [
          activeConversation
        ];
      }

      if (url === `/api/chat/conversations/${activeConversation.id}/read`) {
        return {};
      }

      if (url === `/api/chat/conversations/${activeConversation.id}/messages`) {
        messageRequestCount += 1;

        if (messageRequestCount === 1) return initialMessages.promise;
        if (messageRequestCount === 2) return refreshMessages.promise;
        if (messageRequestCount === 3) return olderMessages.promise;
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the header icon static on initial load, spins only on manual refresh, and stays stable during pagination', async () => {
    await getConversationButton().trigger('click');
    await nextTick();

    const refreshButton = getRefreshButton();
    expect(refreshButton.find('.animate-spin').exists()).toBe(false);

    initialMessages.resolve({
      messages: [
        {
          id: 'msg-1',
          senderId: friendProfile.id,
          body: 'Hello there',
          createdAt: '2026-05-20T10:01:00.000Z',
          deletedAt: null
        }
      ],
      hasMore: true,
      cursor: 'older-cursor'
    });

    await flushPromises();
    await nextTick();

    expect(refreshButton.find('.animate-spin').exists()).toBe(false);

    await refreshButton.trigger('click');
    await nextTick();

    expect(refreshButton.find('.animate-spin').exists()).toBe(true);

    refreshMessages.resolve({
      messages: [
        {
          id: 'msg-2',
          senderId: friendProfile.id,
          body: 'Refreshed copy',
          createdAt: '2026-05-20T10:02:00.000Z',
          deletedAt: null
        }
      ],
      hasMore: true,
      cursor: 'older-cursor'
    });

    await flushPromises();
    await nextTick();

    expect(refreshButton.find('.animate-spin').exists()).toBe(false);

    await getLoadOlderButton().trigger('click');
    await nextTick();

    expect(refreshButton.find('.animate-spin').exists()).toBe(false);

    olderMessages.resolve({
      messages: [
        {
          id: 'msg-0',
          senderId: 'user-1',
          body: 'Older message',
          createdAt: '2026-05-20T09:59:00.000Z',
          deletedAt: null
        }
      ],
      hasMore: false,
      cursor: null
    });

    await flushPromises();
    await nextTick();

    expect(refreshButton.find('.animate-spin').exists()).toBe(false);
  });
});
