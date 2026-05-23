import type { H3Event } from 'h3';

const CHAT_IDENTIFIER_LIMIT = 60;
const CHAT_READ_LIMIT = 100;
const CHAT_TOKEN_LIMIT = 5;
const CHAT_CLEAR_LIMIT = 20;
const CHAT_WINDOW_SECONDS = 60;

interface RateLimitData {
  count: number;
  resetAt: number;
}

const checkRateLimit = async (event: H3Event, key: string, limit: number, errorMessage: string) => {
  const storage = useStorage('chatRateLimit');
  const now = Math.floor(Date.now() / 1000);

  // In-memory mutex to handle concurrent test execution race conditions on the storage item
  const locks = (globalThis as any)._rateLimitLocks || new Map<string, Promise<void>>();
  (globalThis as any)._rateLimitLocks = locks;
  
  while (locks.has(key)) {
    await locks.get(key);
  }
  let release!: () => void;
  const lockPromise = new Promise<void>((resolve) => { release = resolve; });
  locks.set(key, lockPromise);

  try {
    const data = await storage.getItem<RateLimitData>(key);
    if (data && data.resetAt > now) {
      if (data.count >= limit) {
        const retryAfter = data.resetAt - now;
        setResponseHeader(event, 'Retry-After', retryAfter);
        throw createError({
          statusCode: 429,
          statusMessage: errorMessage,
        });
      }
      await storage.setItem(key, { count: data.count + 1, resetAt: data.resetAt }, { ttl: data.resetAt - now });
    } else {
      await storage.setItem(key, { count: 1, resetAt: now + CHAT_WINDOW_SECONDS }, { ttl: CHAT_WINDOW_SECONDS });
    }
  } catch (error: any) {
    if (error.statusCode === 429) throw error;
    console.error('Chat Rate Limit Storage Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal security error.',
    });
  } finally {
    locks.delete(key);
    release();
  }
};

export const checkChatRateLimit = async (event: H3Event, userId: string, targetId?: string) => {
  const key = `chat:user:${userId}:target:${targetId || 'global'}`;
  await checkRateLimit(event, key, CHAT_IDENTIFIER_LIMIT, 'Messaging rate limit exceeded. Please wait a moment.');
};

export const checkChatReadRateLimit = async (event: H3Event, userId: string) => {
  const key = `chat:read:user:${userId}`;
  await checkRateLimit(event, key, CHAT_READ_LIMIT, 'Read rate limit exceeded. Please wait a moment.');
};

export const checkChatTokenRateLimit = async (event: H3Event, userId: string) => {
  const key = `chat:token:user:${userId}`;
  await checkRateLimit(event, key, CHAT_TOKEN_LIMIT, 'Token generation rate limit exceeded. Please wait a moment.');
};

export const checkChatClearRateLimit = async (event: H3Event, userId: string) => {
  const key = `chat:clear:user:${userId}`;
  await checkRateLimit(event, key, CHAT_CLEAR_LIMIT, 'Clear rate limit exceeded. Please wait a moment.');
};
