import './setup';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, createTestUser, createFriendship, deleteTestUser, type User } from './test.utils';
import { PushService } from '../services/push.service';
import { ChatService } from '../services/chat.service';
import * as schema from '../db/schema';
import * as webcryptoPush from '@block65/webcrypto-web-push';

vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: vi.fn(),
}));

vi.stubEnv('VAPID_PRIVATE_KEY', 'test-vapid-private-key');
vi.stubEnv('VAPID_SUBJECT', 'mailto:test@example.com');
vi.stubEnv('VAPID_PUBLIC_KEY', 'test-vapid-public-key');

const mockedBuildPushPayload = vi.mocked(webcryptoPush.buildPushPayload);

const makePayloadResponse = (status: number): Response => {
  const response = new Response(null, { status });
  Object.defineProperty(response, 'ok', { value: status >= 200 && status < 300 });
  return response;
};

const deleteSubsForUsers = async (userIds: string[]) => {
  for (const uid of userIds) {
    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, uid)).catch(() => {});
  }
};

describe('PushService', () => {
  let userA: User;
  let userB: User;
  let userC: User;

  const dummyEndpoint = 'https://push.example.com/device-abc';
  const dummyP256dh = 'BP4oWPiS8l5iX1FJ6H6G8ylxyLz4T6g8RwHK7nT6wK4jLzQ6o9VzPqR4wK4jLzQ6o9VzPqR4wK4jLzQ6o9Vw';
  const dummyAuth = 'dummy-auth-key-value';

  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`PushA_${id}`, `pusha_${id}@example.com`);
    userB = await createTestUser(`PushB_${id}`, `pushb_${id}@example.com`);
    userC = await createTestUser(`PushC_${id}`, `pushc_${id}@example.com`);
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(makePayloadResponse(201));
    vi.stubGlobal('fetch', mockFetch);
    mockedBuildPushPayload.mockResolvedValue({
      headers: {
        authorization: 'vapid t=mock,k=mock',
        'content-encoding': 'aesgcm',
        'content-length': '32',
        'content-type': 'application/octet-stream',
        'crypto-key': 'dh=mock;p256ecdsa=mock',
        encryption: 'salt=mock',
        ttl: '86400',
      },
      method: 'POST',
      body: new Uint8Array(32),
    });
  });

  afterEach(async () => {
    await deleteSubsForUsers([userA.id, userB.id, userC.id]);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  describe('upsertSubscription', () => {
    it('should create a new subscription', async () => {
      const sub = await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
      expect(sub).toBeDefined();
      expect(sub.userId).toBe(userA.id);
      expect(sub.endpoint).toBe(dummyEndpoint);
      expect(sub.disabledAt).toBeNull();
    });

    it('should upsert on duplicate endpoint', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
      const sub2 = await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, new Date('2099-01-01'), null);
      expect(sub2.id).toBeDefined();
      const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, dummyEndpoint));
      expect(subs.length).toBe(1);
      expect(subs[0]!.expirationTime).not.toBeNull();
    });
  });

  describe('disableSubscription', () => {
    it('should soft-disable the current user subscription', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
      await PushService.disableSubscription(db, userA.id, dummyEndpoint);
      const [sub] = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, dummyEndpoint));
      expect(sub!.disabledAt).not.toBeNull();
    });

    it('should NOT soft-disable another user subscription', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
      await PushService.disableSubscription(db, userB.id, dummyEndpoint);
      const [sub] = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, dummyEndpoint));
      expect(sub!.disabledAt).toBeNull();
    });
  });

  describe('findActiveSubscriptions', () => {
    it('should skip disabled subscriptions', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
      await PushService.disableSubscription(db, userA.id, dummyEndpoint);
      const active = await PushService.findActiveSubscriptions(db, userA.id);
      expect(active.length).toBe(0);
    });

    it('should skip expired subscriptions', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint + '/exp', dummyP256dh, dummyAuth, new Date('2020-01-01'), null);
      const active = await PushService.findActiveSubscriptions(db, userA.id);
      expect(active.find(s => s.endpoint === dummyEndpoint + '/exp')).toBeUndefined();
    });

    it('should include non-expired subscriptions', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint, dummyP256dh, dummyAuth, new Date('2099-01-01'), null);
      const active = await PushService.findActiveSubscriptions(db, userA.id);
      expect(active.length).toBe(1);
    });
  });

  describe('notifyUser', () => {
    beforeEach(async () => {
      await PushService.upsertSubscription(db, userB.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
    });

    it('should send push to recipient only (exclude sender)', async () => {
      await PushService.upsertSubscription(db, userA.id, dummyEndpoint + '/sender', dummyP256dh, dummyAuth, null, null);
      await PushService.notifyUser(db, userB.id, userA.id);
      const calls = mockedBuildPushPayload.mock.calls;
      interface SubArg { endpoint: string; keys: { p256dh: string; auth: string } }
      const subArgs = calls.map((c: unknown[]) => c[1] as SubArg);
      const endpoints = subArgs.map((a: SubArg) => a.endpoint);
      expect(endpoints).not.toContain(dummyEndpoint + '/sender');
    });

    it('should NOT send push when recipient blocked sender', async () => {
      await db.insert(schema.userBlocks).values({ blockerId: userB.id, blockedId: userA.id, createdAt: new Date() });
      await PushService.notifyUser(db, userB.id, userA.id);
      expect(mockedBuildPushPayload).not.toHaveBeenCalled();
    });

    it('should NOT send push when sender blocked recipient', async () => {
      await db.insert(schema.userBlocks).values({ blockerId: userA.id, blockedId: userB.id, createdAt: new Date() });
      await PushService.notifyUser(db, userB.id, userA.id);
      expect(mockedBuildPushPayload).not.toHaveBeenCalled();
    });

    it('should not fail when push delivery fails', async () => {
      mockedBuildPushPayload.mockRejectedValue(new Error('Crypto error'));
      await expect(PushService.notifyUser(db, userB.id, userA.id)).resolves.toBeUndefined();
    });

    it('should soft-disable subscription on 410', async () => {
      mockFetch.mockResolvedValue(makePayloadResponse(410));
      await PushService.notifyUser(db, userB.id, userA.id);
      const active = await PushService.findActiveSubscriptions(db, userB.id);
      expect(active.length).toBe(0);
    });

    it('should soft-disable subscription on 404', async () => {
      mockFetch.mockResolvedValue(makePayloadResponse(404));
      await PushService.notifyUser(db, userB.id, userA.id);
      const active = await PushService.findActiveSubscriptions(db, userB.id);
      expect(active.length).toBe(0);
    });

    it('should send payload without message body or sender profile', async () => {
      await PushService.notifyUser(db, userB.id, userA.id);
      const calls = mockedBuildPushPayload.mock.calls;
      for (const call of calls) {
        const message = call[0] as { data: Record<string, string>; options: { ttl: number } };
        expect(message.data.type).toBe('chat.message');
        expect(message.data.title).toBe('New message on Habits Social');
        expect(message.data.body).toBe('Open Inbox to view it.');
        expect(message.data.url).toBe('/inbox');
        expect('messageBody' in (message.data as Record<string, unknown>)).toBe(false);
        expect('senderName' in (message.data as Record<string, unknown>)).toBe(false);
        expect('senderPhoto' in (message.data as Record<string, unknown>)).toBe(false);
      }
    });

    it('should handle multiple subscriptions with bounded concurrency', async () => {
      for (let i = 0; i < 3; i++) {
        await PushService.upsertSubscription(db, userB.id, `${dummyEndpoint}/${i}`, dummyP256dh, dummyAuth, null, null);
      }
      await PushService.notifyUser(db, userB.id, userA.id);
      expect(mockedBuildPushPayload).toHaveBeenCalled();
    });
  });

  describe('chat integration (ChatService.sendMessage triggers push)', () => {
    beforeEach(async () => {
      await createFriendship(userA.id, userB.id, 'accepted');
      await PushService.upsertSubscription(db, userB.id, dummyEndpoint, dummyP256dh, dummyAuth, null, null);
    });

    it('should trigger push for recipient on sendMessage', async () => {
      const notifySpy = vi.spyOn(PushService, 'notifyUser').mockResolvedValue();
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'Hello!');
      expect(notifySpy).toHaveBeenCalledWith(db, userB.id, userA.id);
    });

    it('chat send still succeeds when push delivery fails', async () => {
      vi.spyOn(PushService, 'notifyUser').mockRejectedValue(new Error('Push unavailable'));
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const msg = await ChatService.sendMessage(db, userA.id, conv!.id, 'Still commits');
      expect(msg.body).toBe('Still commits');
    });
  });
});
