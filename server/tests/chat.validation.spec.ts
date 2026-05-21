import { describe, it, expect } from 'vitest';
import { chatMessageSchema, conversationIdSchema, friendIdSchema, messageIdSchema } from '../utils/validation';

describe('Chat Validation', () => {
  describe('Message Body Validation', () => {
    it('should accept valid messages', () => {
      const validMessages = [
        { body: 'Hello!' },
        { body: '👋 How are you?' },
        { body: 'A'.repeat(1000) }
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

    it('should reject messages exceeding 1000 characters', () => {
      const longMessage = { body: 'A'.repeat(1001) };
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
