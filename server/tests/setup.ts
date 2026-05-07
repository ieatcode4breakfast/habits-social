import { vi } from 'vitest';
import { createError } from 'h3';
import { neon } from '@neondatabase/serverless';

vi.stubGlobal('useRuntimeConfig', (event?: any) => {
  return {
    databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/postgres',
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev'
  };
});

vi.stubGlobal('defineEventHandler', (handler: any) => handler);
vi.stubGlobal('createError', createError);
vi.stubGlobal('readBody', async (event: any) => event._body);
vi.stubGlobal('getCookie', (event: any, name: string) => event._cookies?.[name]);
vi.stubGlobal('getRouterParam', (event: any, name: string) => event._params?.[name]);
vi.stubGlobal('getQuery', (event: any) => event._query || {});
vi.stubGlobal('getMethod', (event: any) => event._method || 'GET');
vi.stubGlobal('setResponseHeader', () => {});
vi.stubGlobal('setHeader', () => {});

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
import { toCamelCase } from '../utils/transform';
vi.mock('../utils/db', () => ({
  useDB: () => {
    const sql = neon(process.env.DATABASE_URL!);
    return (...args: any[]) => {
      const result = (sql as any)(...args);
      if (result && typeof result.then === 'function') {
        const originalThen = result.then.bind(result);
        result.then = (onFulfilled?: any, onRejected?: any) => {
          return originalThen((data: any) => {
            const transformed = toCamelCase(data);
            return onFulfilled ? onFulfilled(transformed) : transformed;
          }, onRejected);
        };
      }
      return result;
    };
  }
}));

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
  generateToken: async (userId: string) => `mock-token-${userId}`
}));
