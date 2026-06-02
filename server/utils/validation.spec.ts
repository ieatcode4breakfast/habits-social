import { describe, it, expect } from 'vitest';
import { shareHabitsSchema, syncQuerySchema, registerSchema, updateProfileSchema, insertUserSchema, chatMessageSchema } from './validation';

describe('validation schemas boundaries', () => {
  describe('shareHabitsSchema', () => {
    it('should reject userDate longer than 50 characters', () => {
      const longDate = 'A'.repeat(51);
      const result = shareHabitsSchema.safeParse({
        targetUserId: '00000000-0000-0000-0000-000000000000',
        habitIds: [],
        userDate: longDate
      });
      expect(result.success).toBe(false);
    });
  });

  describe('syncQuerySchema', () => {
    it('should reject cursors string longer than 2048 characters in preprocess', () => {
      const longString = 'A'.repeat(2049);
      expect(() => {
        syncQuerySchema.parse({
          cursors: longString
        });
      }).toThrow('Payload too large');
    });

    it('should reject cursors record with more than 10 keys', () => {
      const record: Record<string, string> = {};
      for (let i = 0; i < 11; i++) {
        record[`key${i}`] = 'value';
      }
      const result = syncQuerySchema.safeParse({
        cursors: JSON.stringify(record)
      });
      expect(result.success).toBe(false);
    });

    it('should reject cursors with long keys', () => {
      const result = syncQuerySchema.safeParse({
        cursors: JSON.stringify({ ['A'.repeat(101)]: 'value' })
      });
      expect(result.success).toBe(false);
    });

    it('should reject cursors with long values', () => {
      const result = syncQuerySchema.safeParse({
        cursors: JSON.stringify({ key: 'A'.repeat(256) })
      });
      expect(result.success).toBe(false);
    });

    it('should preserve valid partial-history date windows', () => {
      const result = syncQuerySchema.parse({
        startDate: '2026-03-31',
        endDate: '2026-05-30'
      });

      expect(result.startDate).toBe('2026-03-31');
      expect(result.endDate).toBe('2026-05-30');
    });

    it('should reject invalid partial-history date windows', () => {
      const result = syncQuerySchema.safeParse({
        startDate: 'not-a-date',
        endDate: '2026-05-30'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('photoUrl limits', () => {
    // Construct a valid URL that is too long (> 2048)
    const longUrl = 'http://example.com/?q=' + 'A'.repeat(2027); // 19 + 3 + 2027 = 2049

    it('should reject long photoUrl in registerSchema', () => {
      const result = registerSchema.safeParse({
        username: 'test',
        email: 'test@example.com',
        password: 'Password123!',
        photoUrl: longUrl
      });
      expect(result.success).toBe(false);
    });

    it('should reject long photoUrl in updateProfileSchema', () => {
      const result = updateProfileSchema.safeParse({
        photoUrl: longUrl
      });
      expect(result.success).toBe(false);
    });

    it('should reject long photoUrl in insertUserSchema', () => {
      const result = insertUserSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000000', // Provide required ID
        username: 'test',
        email: 'test@example.com',
        passwordHash: 'A'.repeat(10), // Ensure password hash is long enough
        photoUrl: longUrl
      });
      expect(result.success).toBe(false);
    });
  });

  describe('chatMessageSchema', () => {
    it('preserves streakAnchorDate in embedded activity reply cards', () => {
      const result = chatMessageSchema.parse({
        body: 'Nice streak',
        replyToActivity: {
          id: 'activity-123',
          type: 'STREAK_MILESTONE',
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            name: 'Alex',
            photoUrl: null
          },
          habit: {
            id: '00000000-0000-0000-0000-000000000001',
            title: 'Meditate'
          },
          message: 'hit a streak',
          date: '2026-05-23',
          timestamp: '2026-05-23T12:00:00.000Z',
          streakCount: 7,
          streakAnchorDate: '2026-05-23'
        }
      });

      expect(result.replyToActivity?.streakAnchorDate).toBe('2026-05-23');
    });
  });
});
