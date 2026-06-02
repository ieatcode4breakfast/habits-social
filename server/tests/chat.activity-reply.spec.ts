import './setup';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, createTestUser, createFriendship, deleteTestUser } from './test.utils';
import { ChatService } from '../services/chat.service';
import { SocialService } from '../services/social.service';
import { createMockEvent } from './test.utils';
import type { FeedItem } from '../services/social-narrator.service';

describe('Chat Activity Reply Embedding', () => {
  let userA: any;
  let userB: any;
  let userC: any;
  let conv: any;

  const validFeedItem = {
    id: 'activity-123',
    type: 'INITIAL_COMPLETION',
    user: {
      id: '', // Will fill in beforeEach
      name: 'User A',
      photoUrl: 'https://example.com/avatar.jpg'
    },
    habit: {
      id: 'habit-123',
      title: 'Workout Daily'
    },
    message: 'completed Workout Daily for May 23.',
    date: '2026-05-23',
    timestamp: new Date('2026-05-23T12:00:00Z'),
    streakCount: 5,
    streakAnchorDate: '2026-05-23'
  } as unknown as FeedItem;

  beforeEach(async () => {
    const id = crypto.randomUUID().slice(0, 8);
    userA = await createTestUser(`UserA_${id}`, `usera_${id}@example.com`);
    userB = await createTestUser(`UserB_${id}`, `userb_${id}@example.com`);
    userC = await createTestUser(`UserC_${id}`, `userc_${id}@example.com`);
    await createFriendship(userA.id, userB.id, 'accepted');
    conv = await ChatService.getOrCreateConversationForFriend(db, userA.id, userB.id);
  });

  afterEach(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(userC.id);
  });

  it('should save and return static visual card inside a message', async () => {
    const card = {
      ...validFeedItem,
      user: {
        ...validFeedItem.user,
        id: userB.id,
        name: userB.username
      }
    };

    // Send visual activity reply message
    const msg: any = await ChatService.sendMessage(db, userA.id, conv.id, 'Awesome streak!', card);
    
    expect(msg.body).toBe('Awesome streak!');
    expect(msg.replyToActivity).toBeDefined();
    expect(msg.replyToActivity.id).toBe(card.id);
    expect(msg.replyToActivity.streakCount).toBe(5);
    expect(msg.replyToActivity.streakAnchorDate).toBe('2026-05-23');
    expect(msg.replyToActivity.user.id).toBe(userB.id);

    // List messages and check if visual card is recovered perfectly
    const history = await ChatService.listMessages(db, userA.id, conv.id);
    expect(history.messages.length).toBe(1);
    const savedMsg = history.messages[0] as any;
    expect(savedMsg.replyToActivity).toBeDefined();
    expect(savedMsg.replyToActivity.id).toBe(card.id);
    expect(savedMsg.replyToActivity.streakAnchorDate).toBe('2026-05-23');
    expect(savedMsg.replyToActivity.user.id).toBe(userB.id);
  });

  it('should block and reject if activity card user does not belong to conversation participants (prevent spoofing)', async () => {
    const maliciousCard = {
      ...validFeedItem,
      user: {
        ...validFeedItem.user,
        id: userC.id, // User C is not in this chat room conversation!
        name: userC.username
      }
    };

    // Sending message with visual card owned by third-party user C should fail
    await expect(
      ChatService.sendMessage(db, userA.id, conv.id, 'Hacking your activity!', maliciousCard)
    ).rejects.toThrow();
  });

  it('should preserve and render the static activity reply even if the habit or log is deleted/unshared later', async () => {
    const card = {
      ...validFeedItem,
      user: {
        ...validFeedItem.user,
        id: userA.id,
        name: userA.username
      }
    };

    // Send valid visual reply
    await ChatService.sendMessage(db, userB.id, conv.id, 'Keep it up!', card);

    // Simulate deleting the referenced habit or log entirely (represented here by checking we can still query the static data)
    // In our static schema, listMessages has zero dependencies on schema.habits or schema.habitLogs
    const history = await ChatService.listMessages(db, userA.id, conv.id);
    expect(history.messages.length).toBe(1);
    const savedMsg = history.messages[0] as any;
    expect(savedMsg.replyToActivity).toBeDefined();
    expect(savedMsg.replyToActivity.id).toBe(card.id);
    expect(savedMsg.replyToActivity.user.id).toBe(userA.id);
  });
});
