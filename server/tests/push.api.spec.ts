import './setup';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';
import { PushService } from '../services/push.service';
import { useDB } from '../utils/db';

vi.stubEnv('VAPID_PRIVATE_KEY', 'test-vapid-private-key');
vi.stubEnv('VAPID_PUBLIC_KEY', 'test-vapid-public-key');

describe('Push API', () => {
  let userA: ReturnType<typeof createTestUser> extends Promise<infer T> ? T : never;
  let userB: ReturnType<typeof createTestUser> extends Promise<infer T> ? T : never;

  const validEndpoint = 'https://push.example.com/device-abc';
  const validP256dh = 'BP4oWPiS8l5iX1FJ6H6G8ylxyLz4T6g8RwHK7nT6wK4jLzQ6o9VzPqR4wK4jLzQ6o9VzPqR4wK4jLzQ6o9Vw';
  const validAuth = 'dummy-auth-key-value';

  beforeAll(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`PushApiA_${id}`, `pushapi_a_${id}@example.com`);
    userB = await createTestUser(`PushApiB_${id}`, `pushapi_b_${id}@example.com`);
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  describe('GET /api/push/vapid-public-key', () => {
    it('should reject when not authenticated', async () => {
      const handler = (await import('../api/push/vapid-public-key.get')).default;
      const event = createMockEvent(userA.id, {}, { auth_token: 'invalid' });

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should return supported: true when VAPID keys are configured', async () => {
      const handler = (await import('../api/push/vapid-public-key.get')).default;
      const event = createMockEvent(userA.id);
      const result: unknown = await handler(event);
      const response = result as { supported: boolean; publicKey?: string };
      expect(response.supported).toBe(true);
      expect(response.publicKey).toBeTypeOf('string');
    });
  });

  describe('POST /api/push/subscriptions', () => {
    it('should reject when not authenticated', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: validEndpoint,
        keys: { p256dh: validP256dh, auth: validAuth },
      }, { auth_token: 'invalid' });

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should reject missing endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it('should reject non-https endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'http://push.example.com/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/https/);
    });

    it('should reject localhost endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://localhost:8080/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/local/);
    });

    it('should reject private IP endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://192.168.1.1/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/private/);
    });

    it('should reject IPv6 unique-local endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://[fc00::1]/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/private/);
    });

    it('should reject IPv6 link-local endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://[fe80::1]/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/private/);
    });

    it('should reject IPv6 unspecified address', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://[::]/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/private/);
    });

    it('should reject endpoint with credentials', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://user:pass@push.example.com/device',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/credentials/);
    });

    it('should reject endpoint with fragment', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'https://push.example.com/device#fragment',
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      await expect(handler(event)).rejects.toThrow(/fragment/);
    });

    it('should reject missing keys', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: validEndpoint,
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it('should successfully create subscription', async () => {
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: validEndpoint,
        keys: { p256dh: validP256dh, auth: validAuth },
      });

      const result: unknown = await handler(event);
      const response = result as { ok: boolean; id: string };
      expect(response.ok).toBe(true);
      expect(response.id).toBeTypeOf('string');
    });

    it('should accept userAgent from header when not in body', async () => {
      const endpoint2 = 'https://push.example.com/device-agent';
      const handler = (await import('../api/push/subscriptions.post')).default;
      const event = createMockEvent(userA.id, {
        endpoint: endpoint2,
        keys: { p256dh: validP256dh, auth: validAuth },
      });
      const result: unknown = await handler(event);
      const response = result as { ok: boolean };
      expect(response.ok).toBe(true);
    });
  });

  describe('DELETE /api/push/subscriptions', () => {
    beforeAll(async () => {
      await PushService.upsertSubscription(useDB(), userA.id, validEndpoint, validP256dh, validAuth, null, null);
    });

    it('should reject when not authenticated', async () => {
      const handler = (await import('../api/push/subscriptions.delete')).default;
      const event = createMockEvent(userA.id, { endpoint: validEndpoint }, { auth_token: 'invalid' });

      await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should reject non-https endpoint', async () => {
      const handler = (await import('../api/push/subscriptions.delete')).default;
      const event = createMockEvent(userA.id, {
        endpoint: 'http://push.example.com/device',
      });

      await expect(handler(event)).rejects.toThrow(/https/);
    });

    it('should successfully disable subscription', async () => {
      const handler = (await import('../api/push/subscriptions.delete')).default;
      const event = createMockEvent(userA.id, { endpoint: validEndpoint });

      const result: unknown = await handler(event);
      const response = result as { ok: boolean };
      expect(response.ok).toBe(true);
    });
  });
});
