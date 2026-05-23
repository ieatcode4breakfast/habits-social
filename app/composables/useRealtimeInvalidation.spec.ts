import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref, type Ref } from 'vue';

const fetchMock = vi.fn();
const socialRefreshMock = vi.fn();
const activeConversationId = ref<string | null>(null);
const stateStore = new Map<string, { value: unknown }>();

const useStateMock = <T>(key: string, init: () => T): Ref<T> => {
  if (!stateStore.has(key)) {
    stateStore.set(key, ref(init()));
  }
  return stateStore.get(key) as Ref<T>;
};

class MockPartySocket extends EventTarget {
  static instances: MockPartySocket[] = [];
  public readonly options: { host: string; room: string; query: () => Promise<Record<string, string>> };
  public closed = false;

  constructor(options: { host: string; room: string; query: () => Promise<Record<string, string>> }) {
    super();
    this.options = options;
    MockPartySocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }
}

vi.mock('partysocket', () => ({
  default: MockPartySocket,
}));

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

vi.mock('./useSocial', () => ({
  useSocial: () => ({
    refresh: socialRefreshMock,
  }),
}));

vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {
    realtimeEnabled: true,
    partykitHost: 'habits-social-realtime-staging.test.partykit.dev',
  },
}));

describe('useRealtimeInvalidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    fetchMock.mockReset();
    socialRefreshMock.mockReset();
    MockPartySocket.instances = [];
    stateStore.clear();
    activeConversationId.value = null;
    fetchMock.mockResolvedValue({ token: 'token-1' });
  });

  afterEach(async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    useRealtimeInvalidation({ activeConversationId }).stop();
    vi.useRealTimers();
  });

  it('connects an authenticated app-wide socket and requests a token', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    const realtime = useRealtimeInvalidation({ activeConversationId });

    realtime.start();
    const socket = MockPartySocket.instances[0];
    expect(socket?.options.host).toBe('habits-social-realtime-staging.test.partykit.dev');
    expect(socket?.options.room).toBe('user-1');

    await expect(socket?.options.query()).resolves.toEqual({ token: 'token-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/realtime/token', { method: 'POST' });
  });

  it('backs off token requests after a failed realtime token fetch', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    fetchMock.mockRejectedValueOnce(new Error('token endpoint unavailable'));
    const realtime = useRealtimeInvalidation({ activeConversationId });

    realtime.start();
    const socket = MockPartySocket.instances[0];

    await expect(socket?.options.query()).rejects.toThrow('token endpoint unavailable');
    await expect(socket?.options.query()).rejects.toThrow('temporarily paused');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    fetchMock.mockResolvedValueOnce({ token: 'token-2' });

    await expect(socket?.options.query()).resolves.toEqual({ token: 'token-2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a 503 realtime token failure as temporary and retries after backoff', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    const serviceUnavailable = Object.assign(new Error('service unavailable'), { statusCode: 503 });
    fetchMock.mockRejectedValueOnce(serviceUnavailable);
    const realtime = useRealtimeInvalidation({ activeConversationId });

    realtime.start();
    const socket = MockPartySocket.instances[0];

    await expect(socket?.options.query()).rejects.toThrow('service unavailable');
    await expect(socket?.options.query()).rejects.toThrow('temporarily paused');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    fetchMock.mockResolvedValueOnce({ token: 'token-after-503' });

    await expect(socket?.options.query()).resolves.toEqual({ token: 'token-after-503' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a 404 realtime token response as a page-session kill switch', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    const realtimeDisabled = Object.assign(new Error('realtime disabled'), { statusCode: 404 });
    fetchMock.mockRejectedValueOnce(realtimeDisabled);
    const realtime = useRealtimeInvalidation({ activeConversationId });

    realtime.start();
    const socket = MockPartySocket.instances[0];

    await expect(socket?.options.query()).rejects.toThrow('realtime disabled');

    await vi.advanceTimersByTimeAsync(30_000);
    fetchMock.mockResolvedValueOnce({ token: 'token-after-404' });

    await expect(socket?.options.query()).rejects.toThrow('Realtime is disabled');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('debounces chat.changed into shared conversation refresh and active chat sequence', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/chat/conversations') {
        return [
          {
            id: 'conversation-1',
            lastMessageAt: '2026-05-22T10:00:00.000Z',
            lastMessageBody: 'Realtime preview',
            lastMessageDeletedAt: null,
            lastMessageSenderId: 'user-2',
            user1Id: 'user-1',
            user2Id: 'user-2',
            unreadCount: 2,
          },
        ];
      }

      return { token: 'token-1' };
    });
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    activeConversationId.value = 'conversation-1';
    useRealtimeInvalidation({ activeConversationId }).start();
    const socket = MockPartySocket.instances[0];

    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"chat.changed"}' }));
    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"chat.changed"}' }));
    await vi.advanceTimersByTimeAsync(250);

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations');
    expect(stateStore.get('chat-inbox-conversations')?.value).toEqual([
      {
        id: 'conversation-1',
        lastMessageAt: '2026-05-22T10:00:00.000Z',
        lastMessageBody: 'Realtime preview',
        lastMessageDeletedAt: null,
        lastMessageSenderId: 'user-2',
        user1Id: 'user-1',
        user2Id: 'user-2',
        unreadCount: 2,
      },
    ]);
    expect(stateStore.get('realtime-chat-refresh-sequence')?.value).toBe(1);
  });

  it('debounces friends.changed into social refresh', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    useRealtimeInvalidation({ activeConversationId }).start();
    const socket = MockPartySocket.instances[0];

    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"friends.changed"}' }));
    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"friends.changed"}' }));
    await vi.advanceTimersByTimeAsync(250);

    expect(socialRefreshMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes chat and friendships on reconnect to recover missed events', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    useRealtimeInvalidation({ activeConversationId }).start();
    const socket = MockPartySocket.instances[0];

    socket?.dispatchEvent(new Event('open'));
    await nextTick();

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations');
    expect(socialRefreshMock).toHaveBeenCalledTimes(1);
  });
});
