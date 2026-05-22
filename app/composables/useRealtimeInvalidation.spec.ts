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

  it('debounces chat.changed into conversation refresh and active message refresh', async () => {
    const { useRealtimeInvalidation } = await import('./useRealtimeInvalidation');
    activeConversationId.value = 'conversation-1';
    useRealtimeInvalidation({ activeConversationId }).start();
    const socket = MockPartySocket.instances[0];

    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"chat.changed"}' }));
    socket?.dispatchEvent(new MessageEvent('message', { data: '{"type":"chat.changed"}' }));
    await vi.advanceTimersByTimeAsync(250);

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations');
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations/conversation-1/messages', { query: { limit: 50 } });
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
