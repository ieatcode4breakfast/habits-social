import { describe, it, expect } from 'vitest';
import { registerSchema, updateProfileSchema, loginSchema, habitSchema, habitUpdateSchema, habitLogSchema, bucketSchema, bucketLogSchema } from '../utils/validation';


describe('User Validation Schemas', () => {
  describe('registerSchema', () => {
    const validData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    it('should pass with valid data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject username < 3 chars', () => {
      const result = registerSchema.safeParse({ ...validData, username: 'ab' });
      expect(result.success).toBe(false);
    });

    it('should accept username = 3 chars', () => {
      const result = registerSchema.safeParse({ ...validData, username: 'abc' });
      expect(result.success).toBe(true);
    });

    it('should reject username > 20 chars', () => {
      const result = registerSchema.safeParse({ ...validData, username: 'a'.repeat(21) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({ ...validData, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('should reject password < 8 chars', () => {
      const result = registerSchema.safeParse({ ...validData, password: '1234567' });
      expect(result.success).toBe(false);
    });

    it('should reject password > 72 chars', () => {
      const result = registerSchema.safeParse({ ...validData, password: 'p'.repeat(73) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid photoUrl', () => {
      const result = registerSchema.safeParse({ ...validData, photoUrl: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('should accept valid photoUrl', () => {
      const result = registerSchema.safeParse({ ...validData, photoUrl: 'https://example.com/pic.jpg' });
      expect(result.success).toBe(true);
    });
  });

  describe('updateProfileSchema', () => {
    it('should reject empty object', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept partial update (username only)', () => {
      const result = updateProfileSchema.safeParse({ username: 'newname' });
      expect(result.success).toBe(true);
    });

    it('should accept partial update (email only)', () => {
      const result = updateProfileSchema.safeParse({ email: 'new@ex.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid username in update', () => {
      const result = updateProfileSchema.safeParse({ username: 'a' });
      expect(result.success).toBe(false);
    });

    it('should allow clearing photoUrl with empty string', () => {
      const result = updateProfileSchema.safeParse({ photoUrl: '' });
      expect(result.success).toBe(true);
    });

    it('should allow clearing photoUrl with null', () => {
      const result = updateProfileSchema.safeParse({ photoUrl: null });
      expect(result.success).toBe(true);
    });
  });

  describe('loginSchema', () => {
    it('should reject password > 72 chars', () => {
      const result = loginSchema.safeParse({ identifier: 'user', password: 'p'.repeat(73) });
      expect(result.success).toBe(false);
    });
  });

  describe('habitSchema', () => {
    it('should reject sharedWith > 100 items', () => {
      const result = habitSchema.safeParse({
        title: 'Habit',
        sharedWith: Array(101).fill('00000000-0000-0000-0000-000000000000')
      });
      expect(result.success).toBe(false);
    });
  });

  describe('habitSchema - Payload Minimization', () => {
    it('should strip derived fields', () => {
      const data = {
        title: 'Habit',
        currentStreak: 5,
        longestStreak: 10,
        streakAnchorDate: '2026-01-01'
      };
      const result: any = habitSchema.parse(data);
      expect(result.currentStreak).toBeUndefined();
      expect(result.longestStreak).toBeUndefined();
      expect(result.streakAnchorDate).toBeUndefined();
    });
  });

  describe('habitUpdateSchema - Payload Protection', () => {
    it('should strip userDate if passed in the payload', () => {
      const updatePayload = {
        title: 'Updated Title',
        userDate: '2026-01-01'
      };
      const parsedPayload: any = habitUpdateSchema.parse(updatePayload);
      expect(parsedPayload.title).toBe('Updated Title');
      expect(parsedPayload.userDate).toBeUndefined();
    });
  });

  describe('habitLogSchema - Payload Minimization', () => {
    it('should strip derived fields', () => {
      const data = {
        habitId: '00000000-0000-0000-0000-000000000000',
        date: '2026-01-01',
        status: 'completed',
        streakCount: 5,
        brokenStreakCount: 2
      };
      const result: any = habitLogSchema.parse(data);
      expect(result.streakCount).toBeUndefined();
      expect(result.brokenStreakCount).toBeUndefined();
    });
  });

  describe('bucketSchema - Payload Minimization', () => {
    it('should strip derived fields', () => {
      const data = {
        title: 'Bucket',
        currentStreak: 5,
        longestStreak: 10,
        streakAnchorDate: '2026-01-01'
      };
      const result: any = bucketSchema.parse(data);
      expect(result.currentStreak).toBeUndefined();
      expect(result.longestStreak).toBeUndefined();
      expect(result.streakAnchorDate).toBeUndefined();
    });
  });

  describe('bucketLogSchema - Payload Minimization', () => {
    it('should strip derived fields', () => {
      const data = {
        bucketId: '00000000-0000-0000-0000-000000000000',
        date: '2026-01-01',
        status: 'completed',
        streakCount: 5,
        brokenStreakCount: 2
      };
      const result: any = bucketLogSchema.parse(data);
      expect(result.streakCount).toBeUndefined();
      expect(result.brokenStreakCount).toBeUndefined();
    });
  });
});
