import './setup';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createFriendship } from './test.utils';
import { ChatService } from '../services/chat.service';
import { useDB } from '../utils/db';
import * as schema from '../db/schema';
import { SocialService } from '../services/social.service';
import { or, eq } from 'drizzle-orm';

describe('Chat Security & Socket Tokens', () => {
  let userA: any;
  let userB: any;
  let userC: any;
  let conv: any;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`SecA_${id}`, `sec_a_${id}@ex.com`);
    userB = await createTestUser(`SecB_${id}`, `sec_b_${id}@ex.com`);
    userC = await createTestUser(`SecC_${id}`, `sec_c_${id}@ex.com`);
    await createFriendship(userA.id, userB.id, 'accepted');
    conv = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
  });

  afterEach(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  describe('Rate Limits', () => {
    it('should enforce message send rate limits', async () => {
      const handler = (await import('../api/chat/conversations/by-friend/[friendId]/messages.post')).default;
      
      const event = createMockEvent(userA.id, { body: 'Flood' }, {}, { friendId: userB.id }, {}, 'POST');
      
      // Send up to the limit (60) concurrently
      await Promise.all(Array.from({ length: 60 }).map(() => handler(event)));
      
      // The 61st should fail
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 });
    }, 15000);

    it('should enforce read-tier rate limits', async () => {
      const handler = (await import('../api/chat/conversations/[id]/messages.get')).default;
      const event = createMockEvent(userA.id, {}, { limit: 1 }, { id: conv.id }, {}, 'GET');
      
      // Read limit is 100 concurrently
      await Promise.all(Array.from({ length: 100 }).map(() => handler(event)));
      
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 });
    }, 15000);

    it('should enforce token generation rate limits', async () => {
      const handler = (await import('../api/chat/socket-token.post')).default;
      const event = createMockEvent(userA.id, { conversationId: conv.id }, {}, {}, {}, 'POST');
      
      // Token limit is 5 concurrently
      await Promise.all(Array.from({ length: 5 }).map(() => handler(event)));
      
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 });
    }, 15000);

    it('should enforce clear conversation rate limits', async () => {
      const handler = (await import('../api/chat/conversations/[id]/clear.post')).default;
      const event = createMockEvent(userA.id, {}, {}, { id: conv.id }, {}, 'POST');
      
      // Clear limit is 20 concurrently
      await Promise.all(Array.from({ length: 20 }).map(() => handler(event)));
      
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 });
    }, 15000);
  });

  describe('Socket Tokens', () => {
    it('should mint a valid socket token for participants', async () => {
      const handler = (await import('../api/chat/socket-token.post')).default;
      const event = createMockEvent(userA.id, { conversationId: conv.id }, {}, {}, {}, 'POST');
      
      const result = await handler(event);
      expect(result.token).toBeDefined();
    });

    it('should reject socket token for non-participants', async () => {
      const handler = (await import('../api/chat/socket-token.post')).default;
      const event = createMockEvent(userC.id, { conversationId: conv.id }, {}, {}, {}, 'POST');
      
      await expect(handler(event)).rejects.toThrow();
    });

    it('should reject socket token for locked conversations (unfriended)', async () => {
      // Unfriend
      const [f] = await useDB().select().from(schema.friendships).where(
        or(eq(schema.friendships.initiatorId, userA.id), eq(schema.friendships.receiverId, userA.id))
      );
      const eventMock = createMockEvent(userA.id);
      await SocialService.removeFriendship(useDB(), userA.id, f!.id, eventMock);
      
      const handler = (await import('../api/chat/socket-token.post')).default;
      const event = createMockEvent(userA.id, { conversationId: conv!.id }, {}, {}, {}, 'POST');
      
      await expect(handler(event)).rejects.toThrow();
    });

    it('should allow clearing a conversation even after being unfriended', async () => {
      // Unfriend
      const [f] = await useDB().select().from(schema.friendships).where(
        or(eq(schema.friendships.initiatorId, userA.id), eq(schema.friendships.receiverId, userA.id))
      );
      const eventMock = createMockEvent(userA.id);
      await SocialService.removeFriendship(useDB(), userA.id, f!.id, eventMock);
      
      const handler = (await import('../api/chat/conversations/[id]/clear.post')).default;
      const event = createMockEvent(userA.id, {}, {}, { id: conv!.id }, {}, 'POST');
      
      const result: any = await handler(event);
      expect(result.success).toBe(true);
    });
  });

  describe('Injection Prevention', () => {
    it('should return script-like messages as inert strings', async () => {
      const scriptBody = '<script>alert("xss")</script>';
      await ChatService.sendMessage(useDB(), userA.id, conv!.id, scriptBody);
      
      const result = await ChatService.listMessages(useDB(), userB.id, conv!.id);
      expect(result.messages[0]?.body).toBe(scriptBody);
      // Backend doesn't "sanitize" away the characters (inert storage), but front-end must handle.
      // However, we want to ensure no execution happens on server-side rendering if any.
    });
  });
});
