import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, createTestUser, createFriendship, deleteTestUser, deleteFriendship, createMockEvent } from './test.utils';
import { ChatService } from '../services/chat.service';
import { UserService } from '../services/user.service';
import { SocialService } from '../services/social.service';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';

describe('Chat Lifecycle', () => {
  let userA: any;
  let userB: any;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`LifeA_${id}`, `life_a_${id}@ex.com`);
    userB = await createTestUser(`LifeB_${id}`, `life_b_${id}@ex.com`);
  });

  afterEach(async () => {
    try {
      if (userA?.id) await deleteTestUser(userA.id);
      if (userB?.id) await deleteTestUser(userB.id);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Unfriend/Refriend Logic', () => {
    it('should lock chat access when unfriended', async () => {
      const f = await createFriendship(userA.id, userB.id, 'accepted');
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      
      // Unfriend
      const event = createMockEvent(userA.id);
      await SocialService.removeFriendship(db, userA.id, f.id, event);
      
      // Access should be denied
      await expect(ChatService.sendMessage(db, userA.id, conv!.id, 'Still there?')).rejects.toThrow();
      await expect(ChatService.listMessages(db, userA.id, conv!.id)).rejects.toThrow();
    });

    it('should restore access and history when refriended', async () => {
      const f1 = await createFriendship(userA.id, userB.id, 'accepted');
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'Old message');
      
      const event = createMockEvent(userA.id);
      await SocialService.removeFriendship(db, userA.id, f1.id, event);
      
      // Refriend
      await createFriendship(userA.id, userB.id, 'accepted');
      const sameConv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      
      expect(sameConv?.id).toBe(conv?.id);
      const messages = await ChatService.listMessages(db, userA.id, conv!.id);
      expect(messages.messages[0]?.body).toBe('Old message');
    });

    it('should NOT list conversation in inbox when unfriended', async () => {
      const f = await createFriendship(userA.id, userB.id, 'accepted');
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'Hello');
      
      const inboxBefore = await ChatService.listConversations(db, userA.id);
      expect(inboxBefore.length).toBe(1);

      const event = createMockEvent(userA.id);
      await SocialService.removeFriendship(db, userA.id, f.id, event);
      
      const inboxAfter = await ChatService.listConversations(db, userA.id);
      expect(inboxAfter.length).toBe(0);
    });

    it('should reject message deletion after chat is locked', async () => {
      const f = await createFriendship(userA.id, userB.id, 'accepted');
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const msg = await ChatService.sendMessage(db, userA.id, conv!.id, 'My secret');
      
      const event = createMockEvent(userA.id);
      await SocialService.removeFriendship(db, userA.id, f.id, event);
      
      await expect(ChatService.deleteMessage(db, userA.id, msg.id)).rejects.toThrow(/Active friendship required/i);
    });
  });

  describe('Account Deletion Tombstoning', () => {
    it('should tombstone messages when account is deleted', async () => {
      await createFriendship(userA.id, userB.id, 'accepted');
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, conv!.id, 'Confidential info');
      
      // Delete userA
      const event = createMockEvent(userA.id);
      await UserService.deleteUser(db, userA.id, event);
      
      // B should see tombstoned message
      const messages = await ChatService.listMessages(db, userB.id, conv!.id);
      expect(messages.messages[0]?.body).toBe('');
      expect(messages.messages[0]?.deletedAt).not.toBeNull();
    });
  });
});
