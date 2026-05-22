import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, createFriendship } from './test.utils';
import { ChatService } from '../services/chat.service';
import { useDB } from '../utils/db';

describe('Chat API', () => {
  let userA: any;
  let userB: any;
  let userC: any;

  beforeAll(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`ApiUserA_${id}`, `api_a_${id}@example.com`);
    userB = await createTestUser(`ApiUserB_${id}`, `api_b_${id}@example.com`);
    userC = await createTestUser(`ApiUserC_${id}`, `api_c_${id}@example.com`);
    await createFriendship(userA.id, userB.id, 'accepted');
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  describe('GET /api/chat/conversations', () => {
    it('should list conversations for authenticated user', async () => {
      const handler = (await import('../api/chat/conversations.get')).default;
      const event = createMockEvent(userA.id);
      
      const result = await handler(event);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('POST /api/chat/conversations/by-friend/:friendId/messages', () => {
    it('should send a message to a friend', async () => {
      const handler = (await import('../api/chat/conversations/by-friend/[friendId]/messages.post')).default;
      const event = createMockEvent(userA.id, { body: 'Hello API' }, {}, { friendId: userB.id }, {}, 'POST');
      
      const result: any = await handler(event);
      expect(result?.body).toBe('Hello API');
      expect(result?.senderId).toBe(userA.id);
    });

    it('should reject messages to non-friends', async () => {
      const handler = (await import('../api/chat/conversations/by-friend/[friendId]/messages.post')).default;
      const event = createMockEvent(userA.id, { body: 'Stranger danger' }, {}, { friendId: userC.id }, {}, 'POST');
      
      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe('GET /api/chat/conversations/:id/messages', () => {
    it('should list messages in a conversation', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
      const handler = (await import('../api/chat/conversations/[id]/messages.get')).default;
      const event = createMockEvent(userA.id, {}, {}, { id: conv!.id });
      
      const result: any = await handler(event);
      expect(result?.messages).toBeDefined();
    });

    it('should reject third-party access', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
      const handler = (await import('../api/chat/conversations/[id]/messages.get')).default;
      const event = createMockEvent(userC.id, {}, {}, { id: conv!.id });
      
      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe('POST /api/chat/conversations/:id/read', () => {
    it('should mark conversation as read', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
      const handler = (await import('../api/chat/conversations/[id]/read.post')).default;
      const event = createMockEvent(userA.id, {}, {}, { id: conv!.id }, {}, 'POST');
      
      const result: any = await handler(event);
      expect(result?.success).toBe(true);
    });
  });

  describe('DELETE /api/chat/messages/:id', () => {
    it('should delete (tombstone) a message', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(useDB(), userA.id, userB.id);
      const msg: any = await ChatService.sendMessage(useDB(), userA.id, conv!.id, 'Delete me');
      const handler = (await import('../api/chat/messages/[id].delete')).default;
      const event = createMockEvent(userA.id, {}, {}, { id: msg!.id }, {}, 'DELETE');
      
      const result: any = await handler(event);
      expect(result?.success).toBe(true);
    });
  });
});
