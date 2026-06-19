import './setup';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { eq, and, or } from 'drizzle-orm';
import { createTestUser, deleteTestUser, db } from './test.utils';
import { SocialService } from '../services/social.service';
import { PushService } from '../services/push.service';
import { friendships as friendshipsTable } from '../db/schema';

const createCfEvent = (): { event: unknown; waitUntilSpy: ReturnType<typeof vi.fn> } => {
  const waitUntilSpy = vi.fn<(p: Promise<unknown>) => void>();
  const event = {
    context: {
      cloudflare: {
        context: {
          waitUntil: waitUntilSpy,
        },
      },
    },
  };
  return { event, waitUntilSpy };
};

describe('Friendship push integration', () => {
  let userA: { id: string; username: string };
  let userB: { id: string; username: string };

  beforeAll(async () => {
    const ts = Date.now();
    userA = await createTestUser(`push_int_a_${ts}`, `pia_${ts}@ex.com`);
    userB = await createTestUser(`push_int_b_${ts}`, `pib_${ts}@ex.com`);
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  /** Helper: delete any friendship between two users */
  const deleteFriendshipPair = async (u1: string, u2: string) => {
    const [fs] = await db.select().from(friendshipsTable).where(
      or(
        and(eq(friendshipsTable.initiatorId, u1), eq(friendshipsTable.receiverId, u2)),
        and(eq(friendshipsTable.initiatorId, u2), eq(friendshipsTable.receiverId, u1))
      )
    );
    if (fs) {
      await db.delete(friendshipsTable).where(eq(friendshipsTable.id, fs.id));
    }
  };

  describe('createFriendship push', () => {
    afterEach(async () => {
      await deleteFriendshipPair(userA.id, userB.id);
    });

    it('should invoke notifyFriendRequestReceived once on successful creation', async () => {
      const spy = vi.spyOn(PushService, 'notifyFriendRequestReceived').mockResolvedValue();
      const { event } = createCfEvent();

      const friendship = await SocialService.createFriendship(db, userA.id, userB.id, event);

      expect(friendship).toBeDefined();
      expect(friendship.status).toBe('pending');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(db, userB.id, userA.id);
      spy.mockRestore();
    });

    it('should not invoke push on duplicate creation', async () => {
      // Pre-create the friendship
      await db.insert(friendshipsTable).values({
        id: crypto.randomUUID(),
        initiatorId: userA.id,
        receiverId: userB.id,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const spy = vi.spyOn(PushService, 'notifyFriendRequestReceived');
      const { event } = createCfEvent();

      await expect(
        SocialService.createFriendship(db, userA.id, userB.id, event)
      ).rejects.toThrow();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should not undo the pending friendship when push rejects', async () => {
      vi.spyOn(PushService, 'notifyFriendRequestReceived').mockRejectedValue(new Error('Push unavailable'));
      const { event } = createCfEvent();

      const friendship = await SocialService.createFriendship(db, userA.id, userB.id, event);

      expect(friendship).toBeDefined();
      expect(friendship.status).toBe('pending');

      // Verify friendship still exists in DB
      const [stored] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, friendship.id));
      expect(stored).toBeDefined();
      expect(stored!.status).toBe('pending');
    });

    it('should register push promise with waitUntil on Cloudflare-style event', async () => {
      vi.spyOn(PushService, 'notifyFriendRequestReceived').mockResolvedValue();
      const { event, waitUntilSpy } = createCfEvent();

      await SocialService.createFriendship(db, userA.id, userB.id, event);

      expect(waitUntilSpy).toHaveBeenCalledTimes(1);
      expect(waitUntilSpy.mock.calls[0]![0]).toBeInstanceOf(Promise);
    });

    it('should succeed without waitUntil when event has no Cloudflare context', async () => {
      vi.spyOn(PushService, 'notifyFriendRequestReceived').mockResolvedValue();
      const plainEvent = {};

      const friendship = await SocialService.createFriendship(db, userA.id, userB.id, plainEvent);

      expect(friendship).toBeDefined();
      expect(friendship.status).toBe('pending');
    });
  });

  describe('acceptFriendship push', () => {
    afterEach(async () => {
      await deleteFriendshipPair(userA.id, userB.id);
    });

    it('should invoke notifyFriendRequestAccepted once on successful pending→accepted transition', async () => {
      // Create a pending friendship that userB can accept
      const [fs] = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId: userA.id,
          receiverId: userB.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const friendshipId = fs!.id;

      const spy = vi.spyOn(PushService, 'notifyFriendRequestAccepted').mockResolvedValue();
      const { event } = createCfEvent();

      const result = await SocialService.acceptFriendship(db, userB.id, friendshipId, event);

      expect(result).toBeDefined();
      expect(result!.status).toBe('accepted');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(db, userA.id, userB.id);
      spy.mockRestore();
    });

    it('should not invoke push again on replay (idempotent acceptance)', async () => {
      // Create and accept first
      const [fs] = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId: userA.id,
          receiverId: userB.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const friendshipId = fs!.id;
      await SocialService.acceptFriendship(db, userB.id, friendshipId, createCfEvent().event);

      const spy = vi.spyOn(PushService, 'notifyFriendRequestAccepted').mockResolvedValue();
      const { event } = createCfEvent();

      // This should still succeed (return the friendship) but not transition
      const result = await SocialService.acceptFriendship(db, userB.id, friendshipId, event);

      expect(result).toBeDefined();
      expect(result!.status).toBe('accepted');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should reject when initiator tries to accept their own request', async () => {
      const [fs] = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId: userA.id,
          receiverId: userB.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const friendshipId = fs!.id;
      const spy = vi.spyOn(PushService, 'notifyFriendRequestAccepted');
      const { event } = createCfEvent();

      const result = await SocialService.acceptFriendship(db, userA.id, friendshipId, event);

      // initiatorId !== userId → not the receiver, existing check fails → undefined
      expect(result).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return undefined for non-existent friendships', async () => {
      const fakeId = crypto.randomUUID();
      const { event } = createCfEvent();

      const result = await SocialService.acceptFriendship(db, userB.id, fakeId, event);
      expect(result).toBeUndefined();
    });

    it('should not undo accepted state when push rejects', async () => {
      vi.spyOn(PushService, 'notifyFriendRequestAccepted').mockRejectedValue(new Error('Push unavailable'));

      const [fs] = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId: userA.id,
          receiverId: userB.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const friendshipId = fs!.id;
      const { event } = createCfEvent();

      const result = await SocialService.acceptFriendship(db, userB.id, friendshipId, event);

      expect(result).toBeDefined();
      expect(result!.status).toBe('accepted');

      // Verify DB state
      const [stored] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
      expect(stored!.status).toBe('accepted');
    });

    it('should register push promise with waitUntil on successful transition', async () => {
      const [fs] = await db.insert(friendshipsTable)
        .values({
          id: crypto.randomUUID(),
          initiatorId: userA.id,
          receiverId: userB.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      const friendshipId = fs!.id;
      vi.spyOn(PushService, 'notifyFriendRequestAccepted').mockResolvedValue();
      const { event, waitUntilSpy } = createCfEvent();

      await SocialService.acceptFriendship(db, userB.id, friendshipId, event);

      expect(waitUntilSpy).toHaveBeenCalledTimes(1);
      expect(waitUntilSpy.mock.calls[0]![0]).toBeInstanceOf(Promise);
    });
  });
});
