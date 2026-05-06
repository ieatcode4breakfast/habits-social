import { describe, it, expect } from 'vitest';
import { registerSchema, updateProfileSchema } from '../_utils/validation';

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

    it('should reject password > 128 chars', () => {
      const result = registerSchema.safeParse({ ...validData, password: 'p'.repeat(129) });
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
});
