import type { H3Event } from 'h3';

const REALTIME_TOKEN_LIMIT = 5;
const REALTIME_TOKEN_WINDOW_SECONDS = 60;

interface RateLimitData {
  count: number;
  resetAt: number;
}

export const checkRealtimeTokenRateLimit = async (event: H3Event, userId: string): Promise<void> => {
  const storage = useStorage('chatRateLimit');
  const now = Math.floor(Date.now() / 1000);
  const key = `realtime:token:user:${userId}`;
  const globalState = globalThis as { __realtimeRateLimitLocks?: Map<string, Promise<void>> };
  const locks = globalState.__realtimeRateLimitLocks || new Map<string, Promise<void>>();
  globalState.__realtimeRateLimitLocks = locks;

  while (locks.has(key)) {
    await locks.get(key);
  }

  let releaseLock: () => void = () => {};
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  locks.set(key, lock);

  try {
    const data = await storage.getItem<RateLimitData>(key);
    if (data && data.resetAt > now) {
      if (data.count >= REALTIME_TOKEN_LIMIT) {
        setResponseHeader(event, 'Retry-After', data.resetAt - now);
        throw createError({
          statusCode: 429,
          statusMessage: 'Realtime token generation rate limit exceeded. Please wait a moment.',
        });
      }

      await storage.setItem(key, { count: data.count + 1, resetAt: data.resetAt }, { ttl: data.resetAt - now });
      return;
    }

    await storage.setItem(
      key,
      { count: 1, resetAt: now + REALTIME_TOKEN_WINDOW_SECONDS },
      { ttl: REALTIME_TOKEN_WINDOW_SECONDS }
    );
  } finally {
    locks.delete(key);
    releaseLock();
  }
};
