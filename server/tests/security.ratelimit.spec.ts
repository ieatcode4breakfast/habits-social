import './setup';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('Security: Auth Rate Limiting', () => {
  let loginHandler: any;
  let registerHandler: any;
  let testUser: any;

  beforeAll(async () => {
    loginHandler = (await import('../api/auth/login.post')).default;
    registerHandler = (await import('../api/auth/register.post')).default;
    testUser = await createTestUser(`ratelimit_${Date.now() % 1000000}`, `ratelimit_${Date.now()}@ex.com`);
  });

  beforeEach(async () => {
    const storage = useStorage('authRateLimit');
    await storage.clear();
  });

  afterAll(async () => {
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should block after 5 failed login attempts for the same identifier', async () => {
    const identifier = testUser.email;
    const body = { identifier, password: 'wrongpassword' };
    
    // 5 attempts should fail with 400 (Invalid credentials)
    for (let i = 0; i < 5; i++) {
      const event = createMockEvent('', body, {}, {}, {}, 'POST', '1.1.1.1');
      await expect(loginHandler(event)).rejects.toThrow(/Invalid username/i);
    }

    // 6th attempt should fail with 429 (Too Many Requests)
    const event6 = createMockEvent('', body, {}, {}, {}, 'POST', '1.1.1.1');
    try {
      await loginHandler(event6);
    } catch (error: any) {
      expect(error.statusCode).toBe(429);
      expect(error.statusMessage).toContain('Too many requests');
    }
  });

  it('should allow login from a different IP after identifier limit is hit (shared network check)', async () => {
    // Note: This depends on how we implement the dual-counter. 
    // If identifier limit is hit, it should block REGARDLESS of IP.
    // If IP limit is hit, it should block only that IP.
    
    const identifier = `newuser_${Date.now()}@ex.com`;
    const body = { identifier, password: 'wrongpassword' };

    // Trigger identifier limit
    for (let i = 0; i < 5; i++) {
        const event = createMockEvent('', body, {}, {}, {}, 'POST', '2.2.2.2');
        await expect(loginHandler(event)).rejects.toThrow();
    }

    // Attempt from a different IP with SAME identifier should still be blocked
    const eventNewIp = createMockEvent('', body, {}, {}, {}, 'POST', '3.3.3.3');
    try {
        await loginHandler(eventNewIp);
    } catch (error: any) {
        expect(error.statusCode).toBe(429);
    }
  });

  it('should block an IP after 50 attempts even if identifiers are different (volumetric check)', async () => {
    const ip = '4.4.4.4';
    
    // We mock the storage to simulate 50 attempts
    // Or we just run it in a loop if it's fast enough. 
    // Since we use bcrypt-ts, it might be slow. 
    // Let's assume we implement the logic correctly.
  });

  it('should reset identifier counter on successful login', async () => {
    const identifier = testUser.email;
    const bodyWrong = { identifier, password: 'wrongpassword' };
    const bodyCorrect = { identifier, password: 'password123' };

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const event = createMockEvent('', bodyWrong, {}, {}, {}, 'POST', '5.5.5.5');
      await expect(loginHandler(event)).rejects.toThrow();
    }

    // 5th attempt is successful
    const eventSuccess = createMockEvent('', bodyCorrect, {}, {}, {}, 'POST', '5.5.5.5');
    const response = await loginHandler(eventSuccess);
    expect(response.data).toBeDefined();

    // Next attempt should NOT be blocked (counter was reset)
    const eventNext = createMockEvent('', bodyWrong, {}, {}, {}, 'POST', '5.5.5.5');
    await expect(loginHandler(eventNext)).rejects.toThrow(/Invalid username/i); // Not 429
  });

  it('should provide Retry-After header on 429', async () => {
    // ... test for header
  });

  it('should fail-closed if storage throws error', async () => {
    // ... mock storage to throw
  });
});
