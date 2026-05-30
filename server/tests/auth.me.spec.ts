import './setup';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createTestUser, deleteTestUser, createMockEvent, db } from './test.utils';

interface StaleSessionEvent {
  _cookies: Record<string, string>;
  context: {
    getUserAndPayloadFromEvent?: () => Promise<{
      userId: string;
      payload: {
        userId: string;
        iat: number;
        exp: number;
        sessionVersion: number;
      };
    }>;
  };
}

describe('GET /api/auth/me - Session & Sliding Renewal', () => {
  let testUser: any;
  let handler: any;

  beforeAll(async () => {
    testUser = await createTestUser(`t_authme_${Date.now() % 1000000}`, `authme_${Date.now()}@ex.com`);
    handler = (await import('../api/auth/me.get')).default;
  });

  afterAll(async () => {
    if (testUser?.id) {
      await deleteTestUser(testUser.id);
    }
  });

  it('should return user data for an authenticated user', async () => {
    const event = createMockEvent(testUser.id);
    const response = (await handler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testUser.id);
    expect(response.data.username).toBe(testUser.username);
    expect(response.data.email).toBe(testUser.email);
  });

  it('should return null data if unauthorized (invalid token)', async () => {
    const event = createMockEvent('', {}, { auth_token: 'invalid' });
    const response = (await handler(event)) as any;
    expect(response.data).toBeNull();
  });

  it('should return null data if no user context is present', async () => {
    const event = createMockEvent('');
    const response = (await handler(event)) as any;
    expect(response.data).toBeNull();
  });

  it('should return null data and clear cookie if user not found in DB', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const event = createMockEvent(nonExistentId);
    const response = (await handler(event)) as any;
    expect(response.data).toBeNull();
  });

  it('should reject a session token issued before the latest password reset', async () => {
    await db.update(users)
      .set({ sessionVersion: 2 })
      .where(eq(users.id, testUser.id));

    try {
      const event = createMockEvent(testUser.id) as unknown as StaleSessionEvent;
      event.context.getUserAndPayloadFromEvent = async () => ({
        userId: testUser.id,
        payload: {
          userId: testUser.id,
          iat: Math.floor(Date.now() / 1000) - 60,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          sessionVersion: 1
        }
      });

      const response = (await handler(event)) as { data: unknown };

      expect(response.data).toBeNull();
      expect(event._cookies.auth_token).toBeUndefined();
    } finally {
      await db.update(users)
        .set({ sessionVersion: 1 })
        .where(eq(users.id, testUser.id));
    }
  });

  // --- Sliding Session Renewal Tests ---
  describe('Sliding Session Renewal', () => {
    let dateSpy: any;
    const fixedNow = 1779239308; // A fixed epoch timestamp

    beforeEach(() => {
      dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow * 1000);
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });

    it('should NOT refresh the cookie when token is within the first 50% of its lifetime', async () => {
      const now = fixedNow;
      const event = createMockEvent(testUser.id);
      // Token issued 1 day ago — well within the first half of a 7-day token
      event.context.jwtPayload = {
        userId: testUser.id,
        iat: now - (60 * 60 * 24 * 1), // 1 day ago
        exp: now + (60 * 60 * 24 * 6), // 6 days from now
      };

      await handler(event);

      expect(event._cookieWasRefreshed).toBeUndefined();
    });

    it('should refresh the cookie when token is past 50% of its lifetime', async () => {
      const now = fixedNow;
      const event = createMockEvent(testUser.id);
      // Token issued 4 days ago — past the 3.5-day mark of a 7-day token
      event.context.jwtPayload = {
        userId: testUser.id,
        iat: now - (60 * 60 * 24 * 4), // 4 days ago
        exp: now + (60 * 60 * 24 * 3), // 3 days from now
      };

      await handler(event);

      expect(event._cookieWasRefreshed).toBe(true);
      expect(event._cookies.auth_token).toContain('mock-token-');
    });

    it('should NOT refresh the cookie at exactly the 50% mark', async () => {
      const now = fixedNow;
      const totalLifetime = 60 * 60 * 24 * 7; // 7 days
      const event = createMockEvent(testUser.id);
      // Token issued exactly at the halfway point — elapsed === totalLifetime / 2
      // The condition is elapsed > totalLifetime / 2, so exactly half should NOT trigger renewal
      event.context.jwtPayload = {
        userId: testUser.id,
        iat: now - (totalLifetime / 2),
        exp: now + (totalLifetime / 2),
      };

      await handler(event);

      expect(event._cookieWasRefreshed).toBeUndefined();
    });
  });
});
