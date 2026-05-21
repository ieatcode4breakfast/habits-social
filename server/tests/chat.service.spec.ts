import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, createTestUser, createFriendship, deleteTestUser } from './test.utils';
import { ChatService } from '../services/chat.service';

describe('Chat Service', () => {
  let userA: any;
  let userB: any;
  let userC: any;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`UserA_${id}`, `usera_${id}@example.com`);
    userB = await createTestUser(`UserB_${id}`, `userb_${id}@example.com`);
    userC = await createTestUser(`UserC_${id}`, `userc_${id}@example.com`);
    await createFriendship(userA.id, userB.id, 'accepted');
  });

  afterEach(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  describe('getOrCreateConversationForFriend', () => {
    it('should create a conversation for accepted friends', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      expect(conv).toBeDefined();
      expect(conv?.id).toBeDefined();
    });

    it('should reuse existing conversation for the same pair', async () => {
      const conv1 = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const conv2 = await ChatService.getOrCreateConversationForFriend(db, userB.id, userA.id);
      expect(conv1?.id).toBe(conv2?.id);
    });

    it('should reject if friendship is not accepted', async () => {
      await createFriendship(userA.id, userC.id, 'pending');
      await expect(ChatService.getOrCreateConversationForFriend(db, userA.id, userC.id)).rejects.toThrow();
    });

    it('should reject if no friendship exists', async () => {
      await expect(ChatService.getOrCreateConversationForFriend(db, userB.id, userC.id)).rejects.toThrow();
    });

    it('should reject self-chat', async () => {
      await expect(ChatService.getOrCreateConversationForFriend(db, userA.id, userA.id)).rejects.toThrow();
    });

    it('should handle concurrent creation requests gracefully', async () => {
      const results = await Promise.all([
        ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id),
        ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id)
      ]);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[0]?.id).toBe(results[1]?.id);
    });
  });

  describe('sendMessage', () => {
    it('should store message and update lastMessageAt', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      const before = new Date(conv!.lastMessageAt!).getTime();
      
      // Artificial delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const msg: any = await ChatService.sendMessage(db, userA.id, conv!.id, 'Hello!');
      expect(msg.body).toBe('Hello!');
      expect(msg.senderId).toBe(userA.id);
      
      const updatedConv: any = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      expect(new Date(updatedConv.lastMessageAt).getTime()).toBeGreaterThan(before);
    });

    it('should reject if user is not a participant', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await expect(ChatService.sendMessage(db, userC.id, conv!.id, 'I am an intruder')).rejects.toThrow();
    });
  });

  describe('listConversations', () => {
    it('should list conversations sorted by lastMessageAt descending', async () => {
      const convAB = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userA.id, convAB!.id, 'Msg 1');
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await createFriendship(userA.id, userC.id, 'accepted');
      const convAC = await ChatService.getOrCreateConversationForFriend(db, userA.id, userC.id);
      await ChatService.sendMessage(db, userA.id, convAC!.id, 'Msg 2');
      
      const conversations = await ChatService.listConversations(db, userA.id);
      expect(conversations.length).toBe(2);
      expect(conversations[0]?.id).toBe(convAC!.id);
      expect(conversations[1]?.id).toBe(convAB!.id);
    });
  });

  describe('Unread State and Pagination', () => {
    it('should calculate unread counts correctly', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      
      // Send 3 messages from B to A
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 1');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 2');
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 3');
      
      const convsA = await ChatService.listConversations(db, userA.id);
      expect(convsA[0]?.unreadCount).toBe(3);
      
      const convsB = await ChatService.listConversations(db, userB.id);
      expect(convsB[0]?.unreadCount).toBe(0); // B sent them, should be 0 unread for B
    });

    it('should mark conversation as read', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await ChatService.sendMessage(db, userB.id, conv!.id, 'Msg 1');
      
      await ChatService.markAsRead(db, userA.id, conv!.id);
      
      const convsA = await ChatService.listConversations(db, userA.id);
      expect(convsA[0]?.unreadCount).toBe(0);
    });

    it('should paginate messages', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      for (let i = 1; i <= 5; i++) {
        await ChatService.sendMessage(db, userA.id, conv!.id, `Msg ${i}`);
        await new Promise(resolve => setTimeout(resolve, 5)); // Ensure unique timestamps
      }
      
      const page1 = await ChatService.listMessages(db, userA.id, conv!.id, { limit: 3 });
      expect(page1.messages.length).toBe(3);
      expect(page1.messages[0]?.body).toBe('Msg 5');
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBeDefined();
      
      const page2 = await ChatService.listMessages(db, userA.id, conv!.id, { limit: 3, cursor: page1.cursor });
      expect(page2.messages.length).toBe(2);
      expect(page2.messages[0]?.body).toBe('Msg 2');
      expect(page2.hasMore).toBe(false);
    }, 15000);

    it('should reject third-party message listing', async () => {
      const conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
      await expect(ChatService.listMessages(db, userC.id, conv!.id)).rejects.toThrow();
    });
  });
});
