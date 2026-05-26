import { describe, it, expect } from 'vitest';
import { chatMessageSchema, conversationIdSchema, friendIdSchema, messageIdSchema } from '../utils/validation';

describe('Chat Validation', () => {
  describe('Message Body Validation', () => {
    it('should accept valid messages', () => {
      const validMessages = [
        { body: 'Hello!' },
        { body: '👋 How are you?' },
        { body: 'A'.repeat(5000) }
      ];
      validMessages.forEach(msg => {
        expect(chatMessageSchema.parse(msg)).toEqual(msg);
      });
    });

    it('should reject empty or whitespace messages', () => {
      const invalidMessages = [
        { body: '' },
        { body: ' ' },
        { body: '   \n  ' }
      ];
      invalidMessages.forEach(msg => {
        expect(() => chatMessageSchema.parse(msg)).toThrow();
      });
    });

    it('should reject messages exceeding 5000 characters', () => {
      const longMessage = { body: 'A'.repeat(5001) };
      expect(() => chatMessageSchema.parse(longMessage)).toThrow();
    });

    it('should reject non-string bodies', () => {
      const invalidMessages = [
        { body: 123 },
        { body: true },
        { body: { text: 'hi' } },
        { body: null }
      ];
      invalidMessages.forEach(msg => {
        expect(() => chatMessageSchema.parse(msg)).toThrow();
      });
    });

    it('should reject attachments or metadata (strict schema)', () => {
      const invalidMessages = [
        { body: 'Hi', attachment: 'file.jpg' },
        { body: 'Hi', metadata: { source: 'web' } }
      ];
      invalidMessages.forEach(msg => {
        expect(() => chatMessageSchema.parse(msg)).toThrow();
      });
    });
  });

  describe('replyToActivity Validation', () => {
    const validFeedItem = {
      id: 'activity-123',
      type: 'INITIAL_COMPLETION',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John Doe',
        photoUrl: 'https://example.com/photo.jpg'
      },
      habit: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Drink Water'
      },
      message: 'completed Drink Water for May 23.',
      date: '2026-05-23',
      timestamp: '2026-05-23T12:00:00.000Z',
      streakCount: 5,
      weeklyStatus: [
        { date: '2026-05-22', status: 'completed' },
        { date: '2026-05-23', status: 'completed' }
      ]
    };

    it('should accept valid replyToActivity objects', () => {
      const inputPayload = {
        body: 'Hype!',
        replyToActivity: validFeedItem
      };
      const expectedPayload = {
        body: 'Hype!',
        replyToActivity: {
          ...validFeedItem,
          timestamp: new Date(validFeedItem.timestamp)
        }
      };
      expect(chatMessageSchema.parse(inputPayload)).toEqual(expectedPayload);
    });

    it('should accept messages with no replyToActivity', () => {
      const payload = { body: 'Hype!' };
      expect(chatMessageSchema.parse(payload)).toEqual(payload);
    });

    it('should reject replyToActivity with missing required fields', () => {
      const invalidFeedItems = [
        { ...validFeedItem, id: undefined },
        { ...validFeedItem, type: undefined },
        { ...validFeedItem, user: undefined },
        { ...validFeedItem, habit: undefined },
        { ...validFeedItem, message: undefined },
        { ...validFeedItem, date: undefined },
        { ...validFeedItem, timestamp: undefined }
      ];
      invalidFeedItems.forEach(card => {
        expect(() => chatMessageSchema.parse({ body: 'Hi', replyToActivity: card })).toThrow();
      });
    });

    it('should reject malformed uuid in replyToActivity user', () => {
      const card = {
        ...validFeedItem,
        user: { ...validFeedItem.user, id: 'invalid-uuid' }
      };
      expect(() => chatMessageSchema.parse({ body: 'Hi', replyToActivity: card })).toThrow();
    });
  });

  describe('ID Validation', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const invalidIds = ['', 'not-a-uuid', 123, null];

    it('should validate conversation IDs', () => {
      expect(conversationIdSchema.parse(validUuid)).toBe(validUuid);
      invalidIds.forEach(id => {
        expect(() => conversationIdSchema.parse(id)).toThrow();
      });
    });

    it('should validate friend IDs', () => {
      expect(friendIdSchema.parse(validUuid)).toBe(validUuid);
      invalidIds.forEach(id => {
        expect(() => friendIdSchema.parse(id)).toThrow();
      });
    });

    it('should validate message IDs', () => {
      expect(messageIdSchema.parse(validUuid)).toBe(validUuid);
      invalidIds.forEach(id => {
        expect(() => messageIdSchema.parse(id)).toThrow();
      });
    });
  });
});
