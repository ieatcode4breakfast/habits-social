import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jwtVerify, SignJWT } from 'jose';
import { createMockEvent, createTestUser, deleteTestUser } from './test.utils';

describe('POST /api/realtime/token', () => {
  const realtimeSecret = 'realtime-token-test-secret';
  let originalRealtimeSecret: string | undefined;

  beforeEach(() => {
    originalRealtimeSecret = process.env.REALTIME_JWT_SECRET;
    process.env.REALTIME_JWT_SECRET = realtimeSecret;
  });

  afterEach(() => {
    if (originalRealtimeSecret === undefined) {
      delete process.env.REALTIME_JWT_SECRET;
    } else {
      process.env.REALTIME_JWT_SECRET = originalRealtimeSecret;
    }
  });

  it('rejects unauthenticated users', async () => {
    const handler = (await import('../api/realtime/token.post')).default;
    const event = createMockEvent('', {}, { auth_token: 'invalid' }, {}, {}, 'POST');

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('issues a 15-minute realtime token for the authenticated user room', async () => {
    const handler = (await import('../api/realtime/token.post')).default;
    const user = await createTestUser(`rt_${Date.now()}`, `rt_${Date.now()}@ex.com`);
    const event = createMockEvent(user.id, {}, {}, {}, {}, 'POST');

    try {
      const response = await handler(event);
      const secret = new TextEncoder().encode(realtimeSecret);
      const { payload } = await jwtVerify(response.token, secret);

      expect(payload.userId).toBe(user.id);
      expect(payload.roomId).toBe(user.id);
      expect(payload.exp).toBeTypeOf('number');
      expect(payload.iat).toBeTypeOf('number');
      expect(Number(payload.exp) - Number(payload.iat)).toBe(15 * 60);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it('uses the Cloudflare Worker NUXT realtime secret when running on the edge', async () => {
    const handler = (await import('../api/realtime/token.post')).default;
    const user = await createTestUser(`rt_cf_${Date.now()}`, `rt_cf_${Date.now()}@ex.com`);
    const cloudflareSecret = 'cloudflare-realtime-token-secret';
    const event = createMockEvent(user.id, {}, {}, {}, {}, 'POST');
    event.context.cloudflare = {
      env: {
        NUXT_REALTIME_JWT_SECRET: cloudflareSecret,
      },
    };
    delete process.env.REALTIME_JWT_SECRET;

    try {
      const response = await handler(event);
      const { payload } = await jwtVerify(response.token, new TextEncoder().encode(cloudflareSecret));

      expect(payload.userId).toBe(user.id);
      expect(payload.roomId).toBe(user.id);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it('rate-limits token generation', async () => {
    const handler = (await import('../api/realtime/token.post')).default;
    const user = await createTestUser(`rt_limit_${Date.now()}`, `rt_limit_${Date.now()}@ex.com`);
    const event = createMockEvent(user.id, {}, {}, {}, {}, 'POST');

    try {
      await Promise.all(Array.from({ length: 5 }, () => handler(event)));
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it('fails closed instead of falling back to the main app JWT secret', async () => {
    const handler = (await import('../api/realtime/token.post')).default;
    const user = await createTestUser(`rt_secret_${Date.now()}`, `rt_secret_${Date.now()}@ex.com`);
    const event = createMockEvent(user.id, {}, {}, {}, {}, 'POST');
    delete process.env.REALTIME_JWT_SECRET;

    try {
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 500 });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describe('PartyKit realtime connection auth', () => {
  it('rejects token and user-room mismatches', async () => {
    const { validateRealtimeConnectionToken } = await import('../../party/server');
    const secret = 'realtime-test-secret';
    const token = await new SignJWT({ userId: 'user-1', roomId: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(secret));

    await expect(validateRealtimeConnectionToken(token, 'user-2', secret)).resolves.toBe('forbidden');
  });
});

describe('PartyKit notification request boundaries', () => {
  it('rejects oversized notification bodies before broadcasting', async () => {
    const { default: RealtimeServer } = await import('../../party/server');
    const broadcast = vi.fn();
    const room = {
      id: crypto.randomUUID(),
      env: { PARTYKIT_NOTIFY_SECRET: 'notify-secret' },
      broadcast,
    } as unknown as import('partykit/server').Room;

    const server = new RealtimeServer(room);
    const request = new Request('https://party.test/party/user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '100000',
        'x-realtime-timestamp': String(Date.now()),
        'x-realtime-signature': 'not-needed',
      },
      body: 'x'.repeat(100000),
    }) as unknown as import('partykit/server').Request;

    const response = await server.onRequest(request);

    expect(response.status).toBe(413);
    expect(broadcast).not.toHaveBeenCalled();
  });
});
