import PartySocket from 'partysocket';
import type { Ref } from 'vue';
import { parseRealtimeInvalidationEvent } from '../../utils/realtime';
import { useChatInbox } from './useChatInbox';

interface RealtimeInvalidationOptions {
  activeConversationId?: Ref<string | null>;
}

interface RealtimeTokenResponse {
  token: string;
}

interface RealtimePublicConfig {
  realtimeEnabled?: boolean;
  partykitHost?: string;
}

interface RealtimeRuntimeConfig {
  public?: RealtimePublicConfig;
}

type RuntimeConfigGetter = () => RealtimeRuntimeConfig;

let socket: PartySocket | null = null;
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let chatRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let friendsRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const TOKEN_REFRESH_MS = 14 * 60 * 1000;
const INVALIDATION_DEBOUNCE_MS = 200;

const clearTimer = (timer: ReturnType<typeof setTimeout> | null): void => {
  if (timer) clearTimeout(timer);
};

const getPublicRealtimeConfig = (): RealtimePublicConfig => {
  const maybeGetter = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
  if (typeof maybeGetter === 'function') {
    return (maybeGetter as RuntimeConfigGetter)().public || {};
  }

  try {
    const config = useRuntimeConfig() as RealtimeRuntimeConfig;
    return config.public || {};
  } catch {
    return {};
  }
};

const fetchRealtimeToken = async (): Promise<string> => {
  const response = await $fetch<RealtimeTokenResponse>('/api/realtime/token', { method: 'POST' });
  return response.token;
};

export const useRealtimeInvalidation = (options: RealtimeInvalidationOptions = {}) => {
  const { user } = useAuth();
  const { refresh: refreshSocial } = useSocial();
  const { refresh: refreshChatInbox } = useChatInbox();
  const sharedActiveConversationId = useState<string | null>('realtime-active-conversation-id', () => null);
  const activeConversationId = options.activeConversationId || sharedActiveConversationId;
  const chatRefreshSequence = useState<number>('realtime-chat-refresh-sequence', () => 0);
  const activeChatLocked = useState<boolean>('realtime-active-chat-locked', () => false);

  const refreshChatSnapshot = async (): Promise<void> => {
    await refreshChatInbox(true);

    if (activeConversationId.value) {
      chatRefreshSequence.value += 1;
    }
  };

  const scheduleChatRefresh = (): void => {
    clearTimer(chatRefreshTimer);
    chatRefreshTimer = setTimeout(() => {
      void refreshChatSnapshot().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown chat refresh failure';
        console.warn('[Realtime] Chat refresh failed:', message);
      });
    }, INVALIDATION_DEBOUNCE_MS);
  };

  const scheduleFriendsRefresh = (): void => {
    clearTimer(friendsRefreshTimer);
    friendsRefreshTimer = setTimeout(() => {
      if (activeConversationId.value) activeChatLocked.value = true;
      void Promise.resolve(refreshSocial(true)).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown friends refresh failure';
        console.warn('[Realtime] Friends refresh failed:', message);
      });
    }, INVALIDATION_DEBOUNCE_MS);
  };

  const refreshSnapshotsNow = (): void => {
    void refreshChatSnapshot().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown reconnect chat refresh failure';
      console.warn('[Realtime] Reconnect chat refresh failed:', message);
    });

    void Promise.resolve(refreshSocial(true)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown reconnect friends refresh failure';
      console.warn('[Realtime] Reconnect friends refresh failed:', message);
    });
  };

  const scheduleTokenRefresh = (): void => {
    clearTimer(tokenRefreshTimer);
    tokenRefreshTimer = setTimeout(() => {
      if (socket) socket.reconnect(4000, 'Refreshing realtime token');
      scheduleTokenRefresh();
    }, TOKEN_REFRESH_MS);
  };

  const start = (): void => {
    if (import.meta.server || socket || !user.value?.id) return;

    const publicConfig = getPublicRealtimeConfig();
    if (publicConfig.realtimeEnabled !== true || !publicConfig.partykitHost) return;

    socket = new PartySocket({
      host: publicConfig.partykitHost,
      room: user.value.id,
      query: async () => ({ token: await fetchRealtimeToken() }),
    });

    socket.addEventListener('open', refreshSnapshotsNow);
    socket.addEventListener('message', (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;

      const parsed = parseRealtimeInvalidationEvent(event.data);
      if (!parsed.success) return;

      if (parsed.data.type === 'chat.changed') {
        scheduleChatRefresh();
        return;
      }

      scheduleFriendsRefresh();
    });

    scheduleTokenRefresh();
  };

  const stop = (): void => {
    clearTimer(tokenRefreshTimer);
    clearTimer(chatRefreshTimer);
    clearTimer(friendsRefreshTimer);
    tokenRefreshTimer = null;
    chatRefreshTimer = null;
    friendsRefreshTimer = null;

    if (socket) {
      socket.close();
      socket = null;
    }
  };

  return {
    activeChatLocked,
    chatRefreshSequence,
    start,
    stop,
  };
};
