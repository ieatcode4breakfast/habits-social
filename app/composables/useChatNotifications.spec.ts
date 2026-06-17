import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const fetchMock = vi.fn();
const isOnlineRef = ref(true);

const mockPushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};

const mockRegistration = {
  pushManager: mockPushManager,
};

const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration),
};

let mockNotificationPermission = 'default';
const mockRequestPermission = vi.fn().mockResolvedValue('granted');

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: isOnlineRef }),
}));

vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('PushManager', {});
vi.stubGlobal('Notification', {
  get permission() { return mockNotificationPermission; },
  set permission(v: string) { mockNotificationPermission = v; },
  requestPermission: mockRequestPermission,
});

describe('useChatNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOnlineRef.value = true;
    fetchMock.mockReset();
    mockNotificationPermission = 'default';
    mockRequestPermission.mockResolvedValue('granted');
    mockPushManager.getSubscription.mockReset();
    mockPushManager.subscribe.mockReset();
    Object.defineProperty(navigator, 'serviceWorker', { value: mockServiceWorker, configurable: true, writable: true });
  });

  it('should return unsupported state when serviceWorker is unavailable', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const mod = await import('./useChatNotifications');
    mod._resetChatNotificationState();
    const { subscriptionState, init } = mod.useChatNotifications();
    await init();
    expect(subscriptionState.value).toBe('unsupported');
  });

  it('should return denied state when permission is denied', async () => {
    mockNotificationPermission = 'denied';
    fetchMock.mockResolvedValue({ supported: true, publicKey: 'test-public-key' });
    const mod = await import('./useChatNotifications');
    mod._resetChatNotificationState();
    const { subscriptionState, init } = mod.useChatNotifications();
    await init();
    expect(subscriptionState.value).toBe('denied');
  });

  it('should call pushManager.subscribe when requesting permission if no existing subscription', async () => {
    fetchMock.mockResolvedValue({ supported: true, publicKey: 'test-public-key' });
    mockPushManager.getSubscription.mockResolvedValue(null);
    mockPushManager.subscribe.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example.com/test',
        keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        expirationTime: null,
      }),
    });

    const mod = await import('./useChatNotifications');
    mod._resetChatNotificationState();
    const { init, requestPermission } = mod.useChatNotifications();
    await init();
    const result = await requestPermission();
    expect(result).toBe(true);
    expect(mockPushManager.subscribe).toHaveBeenCalled();
  });

  it('should sync existing subscription without requesting permission again', async () => {
    mockNotificationPermission = 'granted';
    fetchMock.mockResolvedValue({ supported: true, publicKey: 'test-public-key' });
    mockPushManager.getSubscription.mockResolvedValue({
      toJSON: () => ({
        endpoint: 'https://push.example.com/existing',
        keys: { p256dh: 'existing-p256dh', auth: 'existing-auth' },
        expirationTime: null,
      }),
    });

    const mod = await import('./useChatNotifications');
    mod._resetChatNotificationState();
    const { init } = mod.useChatNotifications();
    await init();

    const postCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => typeof c[1] === 'object' && c[1] !== null && 'method' in (c[1] as Record<string, unknown>) && (c[1] as Record<string, string>).method === 'POST'
    );
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const syncCall = postCalls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('/api/push/subscriptions')
    );
    expect(syncCall).toBeDefined();
  });
});
