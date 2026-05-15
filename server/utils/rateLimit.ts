import type { H3Event } from 'h3';

const IDENTIFIER_LIMIT = 5;
const IP_LIMIT = 50;
const WINDOW_SECONDS = 900; // 15 minutes

interface RateLimitData {
  count: number;
  resetAt: number;
}

export const checkRateLimit = async (event: H3Event, identifier: string) => {
  const storage = useStorage('authRateLimit');
  // @ts-ignore - _getRequestIP is added by our test mock
  const ip = event._getRequestIP ? event._getRequestIP() : getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  
  const idKey = `id:${identifier.toLowerCase()}`;
  const ipKey = `ip:${ip}`;

  const now = Math.floor(Date.now() / 1000);

  try {
    // 1. Check Identifier Limit
    const idData = await storage.getItem<RateLimitData>(idKey);
    if (idData && idData.resetAt > now) {
      if (idData.count >= IDENTIFIER_LIMIT) {
        const retryAfter = idData.resetAt - now;
        setResponseHeader(event, 'Retry-After', retryAfter.toString());
        throw createError({
          statusCode: 429,
          statusMessage: 'Too many requests. Please try again later.',
        });
      }
      await storage.setItem(idKey, { count: idData.count + 1, resetAt: idData.resetAt }, { ttl: idData.resetAt - now });
    } else {
      await storage.setItem(idKey, { count: 1, resetAt: now + WINDOW_SECONDS }, { ttl: WINDOW_SECONDS });
    }

    // 2. Check IP Limit
    const ipData = await storage.getItem<RateLimitData>(ipKey);
    if (ipData && ipData.resetAt > now) {
      if (ipData.count >= IP_LIMIT) {
        const retryAfter = ipData.resetAt - now;
        setResponseHeader(event, 'Retry-After', retryAfter.toString());
        throw createError({
          statusCode: 429,
          statusMessage: 'Too many requests from this IP. Please try again later.',
        });
      }
      await storage.setItem(ipKey, { count: ipData.count + 1, resetAt: ipData.resetAt }, { ttl: ipData.resetAt - now });
    } else {
      await storage.setItem(ipKey, { count: 1, resetAt: now + WINDOW_SECONDS }, { ttl: WINDOW_SECONDS });
    }
  } catch (error: any) {
    if (error.statusCode === 429) throw error;
    
    // Fail-closed logic
    console.error('Rate Limit Storage Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal security error. Please try again later.',
    });
  }
};

export const resetRateLimit = async (event: H3Event, identifier: string) => {
  try {
    const storage = useStorage('authRateLimit');
    const idKey = `id:${identifier.toLowerCase()}`;
    await storage.removeItem(idKey);
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
    // Non-blocking, just log it
  }
};
