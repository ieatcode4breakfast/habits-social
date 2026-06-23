import './setup';
import { describe, it, expect, beforeAll } from 'vitest';

// ponytail: smallest check that fails if preflight handling breaks.
// Verifies the three invariants the Android login failure was caused by:
//   1. OPTIONS /api/** is short-circuited (returns non-undefined so no
//      downstream requireAuth runs and 401s the preflight).
//   2. The X-Habits-Client + Authorization headers are advertised as allowed
//      (preflight will otherwise reject requests carrying those custom headers).
//   3. Non-OPTIONS requests and non-/api/ paths pass through untouched so
//      normal routes and cookie-auth keep working.

describe('CORS preflight middleware (server/middleware/cors.ts)', () => {
  let middleware: (event: unknown) => Promise<unknown>;

  beforeAll(async () => {
    middleware = (await import('../middleware/cors')).default as (event: unknown) => Promise<unknown>;
  });

  const makeEvent = (method: string, path: string) => ({
    _method: method,
    method,
    _path: path,
    path,
    _headers: {} as Record<string, string>,
    context: {},
  });

  it('short-circuits OPTIONS /api/auth/login with the required CORS headers', async () => {
    const event = makeEvent('OPTIONS', '/api/auth/login');
    const result = await middleware(event);

    // (1) Short-circuited — a non-undefined return prevents downstream handlers.
    expect(result).not.toBeUndefined();

    // (2) Headers that the Android X-Habits-Client + Authorization bearer flow
    //     needs to be advertised as allowed, or the WebView preflight rejects.
    expect(event._headers['access-control-allow-origin']).toBe('*');
    expect(event._headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(event._headers['access-control-allow-headers']).toContain('X-Habits-Client');
    expect(event._headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('passes through non-OPTIONS requests without touching CORS state', async () => {
    const event = makeEvent('POST', '/api/auth/login');
    const result = await middleware(event);

    // Returns undefined → Nitro continues to the actual route handler.
    expect(result).toBeUndefined();
    expect(event._headers['access-control-allow-origin']).toBeUndefined();
  });

  it('passes through OPTIONS for non-/api/ paths (help center, static, etc.)', async () => {
    const event = makeEvent('OPTIONS', '/help-center/welcome');
    const result = await middleware(event);

    expect(result).toBeUndefined();
    expect(event._headers['access-control-allow-origin']).toBeUndefined();
  });
});