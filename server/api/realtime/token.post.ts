import { SignJWT } from 'jose';
import type { H3Event } from 'h3';
import { requireAuth } from '~~/server/utils/auth';
import { checkRealtimeTokenRateLimit } from '~~/server/utils/realtimeRateLimit';

interface RealtimeRuntimeConfig {
  realtimeJwtSecret?: string;
}

interface CloudflareRealtimeContext {
  cloudflare?: {
    env?: {
      NUXT_REALTIME_JWT_SECRET?: string;
      REALTIME_JWT_SECRET?: string;
    };
  };
}

type RuntimeConfigGetter = (event?: H3Event) => RealtimeRuntimeConfig;

const getRuntimeConfigGetter = (): RuntimeConfigGetter => {
  const maybeGetter = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
  if (typeof maybeGetter === 'function') {
    return maybeGetter as RuntimeConfigGetter;
  }
  return useRuntimeConfig as RuntimeConfigGetter;
};

const getRealtimeJwtSecret = (event: H3Event): string => {
  const config = getRuntimeConfigGetter()(event);
  const cloudflareEnv = (event.context as CloudflareRealtimeContext).cloudflare?.env;
  const secret =
    cloudflareEnv?.NUXT_REALTIME_JWT_SECRET ||
    cloudflareEnv?.REALTIME_JWT_SECRET ||
    config.realtimeJwtSecret ||
    process.env.REALTIME_JWT_SECRET;
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'Realtime configuration missing' });
  }
  return secret;
};

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  await checkRealtimeTokenRateLimit(event, userId);

  const secret = new TextEncoder().encode(getRealtimeJwtSecret(event));
  const token = await new SignJWT({ userId, roomId: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);

  return { token };
});
