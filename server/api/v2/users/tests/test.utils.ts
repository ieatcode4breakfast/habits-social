import { vi } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { hash } from 'bcrypt-ts';
import { SignJWT } from 'jose';

import { createError } from 'h3';

// Mock Nuxt/Nitro globals used in the endpoints
vi.stubGlobal('useRuntimeConfig', () => ({
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev'
}));

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

// Initialize direct DB connection for setup/teardown
const sql = neon(process.env.DATABASE_URL!);

export const createTestUser = async (username: string, email: string) => {
  const passwordHash = await hash('password123', 10);
  const result = await sql`
    INSERT INTO users (username, email, "passwordHash", "createdAt")
    VALUES (${username}, ${email}, ${passwordHash}, NOW())
    RETURNING id, username, email
  `;
  return result[0];
};

export const deleteTestUser = async (userId: string) => {
  await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
};

export const createMockEvent = (userId: string, body: any = {}, cookies: any = {}) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-for-dev');
  
  return {
    _body: body,
    _cookies: {
      auth_token: 'mock-token', // We mock requireAuth to return the userId directly to avoid JWT complexity in unit tests
      ...cookies
    },
    context: {}
  } as any;
};
