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

vi.stubGlobal('$fetch', async (url: string, opts: any) => {
  const res = await fetch(url, { ...opts, signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined });
  if (!res.ok) throw new Error('Fetch failed');
  return res;
});
(global as any).$fetch.raw = async (url: string, opts: any) => {
  return await fetch(url, { ...opts, signal: opts.timeout ? AbortSignal.timeout(opts.timeout) : undefined });
};

// Global mocks for local utils
vi.mock('../utils/db', () => ({
  useDB: () => neon(process.env.DATABASE_URL!)
}));

vi.mock('../utils/auth', () => ({
  requireAuth: async (event: any) => {
    if (event._cookies?.auth_token === 'invalid') {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    return event.context.userId;
  }
}));
