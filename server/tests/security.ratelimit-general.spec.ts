import './setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generalCheckRateLimit } from '../utils/generalRateLimit';
import { createMockEvent } from './test.utils';

describe('Security: General Rate Limiting', () => {
  beforeEach(async () => {
    const storage = useStorage('generalRateLimit');
    await storage.clear();
  });

  it('should allow requests under the default limit', async () => {
    const userId = 'test-user-allow';
    for (let i = 0; i < 5; i++) {
      const event = createMockEvent(userId);
      await expect(generalCheckRateLimit(event, userId)).resolves.toBeUndefined();
    }
  });

  it('should block after exceeding default identifier limit (30)', async () => {
    const userId = 'test-user-default-30';
    for (let i = 0; i < 30; i++) {
      const event = createMockEvent(userId);
      await generalCheckRateLimit(event, userId);
    }
    const event = createMockEvent(userId);
    try {
      await generalCheckRateLimit(event, userId);
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
      expect(error.statusMessage).toContain('Too many requests');
    }
  });

  it('should respect custom maxPerIdentifier as low as 10 (sync/bulk pattern)', async () => {
    const userId = 'test-user-custom-10';
    for (let i = 0; i < 10; i++) {
      const event = createMockEvent(userId);
      await generalCheckRateLimit(event, userId, { maxPerIdentifier: 10 });
    }
    const event = createMockEvent(userId);
    try {
      await generalCheckRateLimit(event, userId, { maxPerIdentifier: 10 });
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
    }
  });

  it('should respect custom maxPerIdentifier of 20 (friendships pattern)', async () => {
    const userId = 'test-user-custom-20';
    for (let i = 0; i < 20; i++) {
      const event = createMockEvent(userId);
      await generalCheckRateLimit(event, userId, { maxPerIdentifier: 20 });
    }
    const event = createMockEvent(userId);
    try {
      await generalCheckRateLimit(event, userId, { maxPerIdentifier: 20 });
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
    }
  });

  it('should identify by IP when using a static identifier like password-reset', async () => {
    const staticId = 'password-reset';
    for (let i = 0; i < 5; i++) {
      const event = createMockEvent('', {}, {}, {}, {}, 'POST', '10.0.0.1');
      event.context.userId = undefined;
      await generalCheckRateLimit(event, staticId, { maxPerIdentifier: 5, windowSeconds: 900 });
    }
    // 6th from same IP should hit the per-identifier limit (static ID)
    const event = createMockEvent('', {}, {}, {}, {}, 'POST', '10.0.0.1');
    event.context.userId = undefined;
    try {
      await generalCheckRateLimit(event, staticId, { maxPerIdentifier: 5, windowSeconds: 900 });
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
    }
  });

  it('should set Retry-After header on 429', async () => {
    const userId = 'test-user-retry';
    for (let i = 0; i < 30; i++) {
      const event = createMockEvent(userId);
      await generalCheckRateLimit(event, userId);
    }
    const event = createMockEvent(userId);
    try {
      await generalCheckRateLimit(event, userId);
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
      expect(event._headers).toBeDefined();
      expect(event._headers['retry-after']).toBeDefined();
      const retryAfter = parseInt(event._headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    }
  });

  it('should fail-closed if storage throws error', async () => {
    const originalUseStorage = (global as any).useStorage;
    (global as any).useStorage = vi.fn().mockImplementation(() => {
      return {
        getItem: () => { throw new Error('KV storage failure'); },
        setItem: () => { throw new Error('KV storage failure'); },
        removeItem: () => { throw new Error('KV storage failure'); },
        clear: () => { throw new Error('KV storage failure'); }
      };
    });

    try {
      const userId = 'test-user-failclose';
      const event = createMockEvent(userId);
      await expect(generalCheckRateLimit(event, userId)).rejects.toMatchObject({
        statusCode: 500,
        statusMessage: expect.stringContaining('Internal security error')
      });
    } finally {
      (global as any).useStorage = originalUseStorage;
    }
  });
});
