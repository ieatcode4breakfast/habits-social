import { vi } from 'vitest';
import { createError } from 'h3';
import * as schema from '../db/schema';

vi.stubGlobal('useRuntimeConfig', (event?: any) => {
  return {
    databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/postgres',
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || 'test-vapid-private-key',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:test@example.com',
    public: {
      realtimeEnabled: true,
      partykitHost: 'habits-social-realtime-test.partykit.dev',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'test-vapid-public-key',
    },
  };
});

vi.stubGlobal('defineEventHandler', (handler: any) => handler);
vi.stubGlobal('createError', createError);
vi.stubGlobal('readBody', async (event: any) => event._body);
vi.stubGlobal('getCookie', (event: any, name: string) => event._cookies?.[name]);
vi.stubGlobal('getRouterParam', (event: any, name: string) => event._params?.[name]);
vi.stubGlobal('getQuery', (event: any) => event._query || {});
vi.stubGlobal('getMethod', (event: any) => event._method || 'GET');
vi.stubGlobal('setResponseHeader', (event: any, name: string, value: string) => {
  if (!event._headers) event._headers = {};
  event._headers[name.toLowerCase()] = value;
});
vi.stubGlobal('setHeader', (event: any, name: string, value: string) => {
  if (!event._headers) event._headers = {};
  event._headers[name.toLowerCase()] = value;
});
vi.stubGlobal('getRequestIP', (event: any) => event._ip || '127.0.0.1');
vi.stubGlobal('getHeader', (event: any, name: string) => {
  if (event._headers?.[name.toLowerCase()]) return event._headers[name.toLowerCase()];
  return undefined;
});

const storageMock: Record<string, any> = {};
vi.stubGlobal('useStorage', (base: string) => {
  return {
    getItem: async (key: string) => storageMock[`${base}:${key}`] || null,
    setItem: async (key: string, value: any) => { storageMock[`${base}:${key}`] = value; },
    removeItem: async (key: string) => { delete storageMock[`${base}:${key}`]; },
    clear: async () => { for (const key in storageMock) delete storageMock[key]; }
  };
});

vi.stubGlobal('setCookie', (event: any, name: string, value: string, opts?: any) => {
  if (!event._cookies) event._cookies = {};
  event._cookies[name] = value;
});
vi.stubGlobal('deleteCookie', (event: any, name: string) => {
  if (event._cookies) delete event._cookies[name];
});

vi.stubGlobal('$fetch', async (url: string, opts: any) => {
  const res = await fetch(url, { ...opts, signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined });
  if (!res.ok) throw new Error('Fetch failed');
  return res;
});
(global as any).$fetch.raw = async (url: string, opts: any) => {
  return await fetch(url, { ...opts, signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined });
};

// Global mocks for local utils
vi.mock('../utils/db', async (importOriginal) => {
  const actual = await importOriginal() as any;
  const { db } = await import('./test.utils');
  return {
    ...actual,
    useDB: () => db
  };
});


vi.mock('../utils/auth', () => ({
  requireAuth: async (event: any) => {
    if (event._cookies?.auth_token === 'invalid') {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    return event.context.userId;
  },
  getUserFromEvent: async (event: any) => {
    if (event._cookies?.auth_token === 'invalid') return null;
    return event.context?.userId || null;
  },
  getUserAndPayloadFromEvent: async (event: any) => {
    if (event._cookies?.auth_token === 'invalid') return null;
    if (!event.context?.userId) return null;
    // Support custom payload injection for sliding renewal tests
    const payload = event.context?.jwtPayload || {
      userId: event.context.userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };
    return { userId: event.context.userId, payload };
  },
  generateToken: async (userId: string) => `mock-token-${userId}`,
  setAuthCookie: (event: any, token: string) => {
    if (!event._cookies) event._cookies = {};
    event._cookies.auth_token = token;
    // Track that a cookie was set for test assertions
    event._cookieWasRefreshed = true;
  },

  AUTH_COOKIE_NAME: 'auth_token',
  SESSION_MAX_AGE_SECONDS: 60 * 60 * 24 * 7,
  SESSION_EXPIRATION_JWT: '7d',
  BCRYPT_COST_FACTOR: 10,
  DUMMY_HASH: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgNIhp.pX7wMQRpM64ls7ZSXH0uz'
}));
