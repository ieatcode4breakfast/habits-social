import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('POST /api/v2/auth/login', () => {
  let handler: any;
  let testUser: any;

  beforeAll(async () => {
    handler = (await import('../auth/login.post')).default;
    testUser = await createTestUser(`login_${Date.now() % 1000000}`, `login_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    if (testUser?.id) await deleteTestUser(testUser.id);
  });

  it('should login with email successfully', async () => {
    const event = createMockEvent('', { identifier: testUser.email, password: 'password123' });
    const response = (await handler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testUser.id);
    expect(response.data.email).toBe(testUser.email);
  });

  it('should login with username successfully', async () => {
    const event = createMockEvent('', { identifier: testUser.username, password: 'password123' });
    const response = (await handler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(testUser.id);
  });

  it('should reject invalid credentials', async () => {
    const event = createMockEvent('', { identifier: testUser.email, password: 'wrongpassword' });
    await expect(handler(event)).rejects.toThrow(/Invalid username/i);
  });
});
