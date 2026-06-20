import { getHeader, type H3Event } from 'h3';

interface RateLimitData {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests per identifier (e.g. userId) within the window. Default: 30 */
  maxPerIdentifier?: number;
  /** Maximum requests per IP within the window. Default: 100 */
  maxPerIp?: number;
  /** Sliding window duration in seconds. Default: 60 */
  windowSeconds?: number;
}

const DEFAULT_MAX_PER_IDENTIFIER = 30;
const DEFAULT_MAX_PER_IP = 100;
const DEFAULT_WINDOW_SECONDS = 60;

/**
 * General-purpose rate limiter for non-auth endpoints.
 * Applies a dual-layer sliding window: per-identifier (e.g. userId) and per-IP.
 *
 * Use overrides for endpoints that need tighter throttling:
 *   await generalCheckRateLimit(event, userId, { maxPerIdentifier: 10 });
 *
 * @param event  - The H3 event (used to extract IP and set Retry-After header).
 * @param identifier - The entity to rate-limit (typically userId).
 * @param config - Optional overrides for limits and window size.
 */
export const generalCheckRateLimit = async (
  event: H3Event,
  identifier: string,
  config?: RateLimitConfig,
): Promise<void> => {
  const storage = useStorage('generalRateLimit');
  const maxPerIdentifier = config?.maxPerIdentifier ?? DEFAULT_MAX_PER_IDENTIFIER;
  const maxPerIp = config?.maxPerIp ?? DEFAULT_MAX_PER_IP;
  const windowSeconds = config?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  // Use CF-Connecting-IP (Cloudflare-controlled, not spoofable). Falls back
  // to getRequestIP for local dev where Cloudflare isn't in the path.
  // @ts-ignore - _getRequestIP is added by our test mock
  const ip =
    (event as any)._getRequestIP?.() ??
    getHeader(event, 'cf-connecting-ip') ??
    getRequestIP(event) ??
    'unknown';

  const idKey = `id:${identifier.toLowerCase()}`;
  const ipKey = `ip:${ip}`;

  const now = Math.floor(Date.now() / 1000);

  try {
    // 1. Check Identifier Limit
    const idData = await storage.getItem<RateLimitData>(idKey);
    if (idData && idData.resetAt > now) {
      if (idData.count >= maxPerIdentifier) {
        const retryAfter = idData.resetAt - now;
        setResponseHeader(event, 'Retry-After', retryAfter);
        throw createError({
          statusCode: 429,
          statusMessage: 'Too many requests. Please try again later.',
        });
      }
      await storage.setItem(
        idKey,
        { count: idData.count + 1, resetAt: idData.resetAt },
        { ttl: idData.resetAt - now },
      );
    } else {
      await storage.setItem(
        idKey,
        { count: 1, resetAt: now + windowSeconds },
        { ttl: windowSeconds },
      );
    }

    // 2. Check IP Limit
    const ipData = await storage.getItem<RateLimitData>(ipKey);
    if (ipData && ipData.resetAt > now) {
      if (ipData.count >= maxPerIp) {
        const retryAfter = ipData.resetAt - now;
        setResponseHeader(event, 'Retry-After', retryAfter);
        throw createError({
          statusCode: 429,
          statusMessage: 'Too many requests from this IP. Please try again later.',
        });
      }
      await storage.setItem(
        ipKey,
        { count: ipData.count + 1, resetAt: ipData.resetAt },
        { ttl: ipData.resetAt - now },
      );
    } else {
      await storage.setItem(
        ipKey,
        { count: 1, resetAt: now + windowSeconds },
        { ttl: windowSeconds },
      );
    }
  } catch (error: any) {
    if (error.statusCode === 429) throw error;

    // Fail-closed: if storage is down, deny the request
    console.error('General Rate Limit Storage Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal security error. Please try again later.',
    });
  }
};
