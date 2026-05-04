import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';
import handler from '../me.get';

vi.mock('../../../../utils/db', () => ({
  useDB: () => neon(process.env.DATABASE_URL!)
}));

vi.mock('../../../../utils/auth', () => ({
  requireAuth: async (event: any) => {
    if (event._cookies?.auth_token === 'invalid') {
      throw (global as any).createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    return event.context.userId;
  }
}));

describe('GET /api/v2/users/me', () => {
  let testUser: any;

  beforeAll(async () => {
    testUser = await createTestUser(`t_get_${Date.now() % 1000000}`, `g_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (testUser?.id) {
      await deleteTestUser(testUser.id);
    }
  });

  it('should return user data for an authenticated user', async () => {
    const event = createMockEvent(testUser.id);
    event.context.userId = testUser.id; // Used by our mocked requireAuth

    const response = (await handler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data!.id).toBe(testUser.id);
    expect(response.data!.username).toBe(testUser.username);
    expect(response.data!.email).toBe(testUser.email);
    expect(response.data!).toHaveProperty('photourl');
    expect(response.data!).toHaveProperty('createdAt');
  });

  it('should throw 401 if unauthorized', async () => {
    const event = createMockEvent('', {}, { auth_token: 'invalid' });
    
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });

  it('should throw 404 if user not found in DB', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const event = createMockEvent(nonExistentId);
    event.context.userId = nonExistentId;

    await expect(handler(event)).rejects.toThrow('User not found');
  });
});
