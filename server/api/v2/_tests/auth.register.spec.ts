import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('POST /api/v2/auth/register', () => {
  let handler: any;

  beforeAll(async () => {
    handler = (await import('../auth/register.post')).default;
  });

  afterAll(async () => {
    // Cleanup any users created by tests
  });

  it('should register a new user successfully', async () => {
    const username = `reg_${Date.now() % 1000000}`;
    const email = `reg_${Date.now()}@ex.com`;
    const event = createMockEvent('', { email, password: 'password123', username });

    const response = (await handler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.email).toBe(email);
    expect(response.data.username).toBe(username);

    // Cleanup
    await deleteTestUser(response.data.id);
  });

  it('should reject duplicate email', async () => {
    const testUser = await createTestUser(`dup_${Date.now() % 1000000}`, `dup_${Date.now()}@ex.com`);
    const event = createMockEvent('', { email: testUser!.email, password: 'password123', username: `u_${Date.now()}` });

    await expect(handler(event)).rejects.toThrow(/already taken/i);
    await deleteTestUser(testUser!.id);
  });

  it('should reject duplicate username case-insensitively', async () => {
    const originalUsername = `CaseUser_${Date.now() % 1000}`;
    const testUser = await createTestUser(originalUsername, `case_${Date.now()}@ex.com`);
    
    // Attempt to register with same username but different case
    const event = createMockEvent('', { 
      email: `different_${Date.now()}@ex.com`, 
      password: 'password123', 
      username: originalUsername.toUpperCase() 
    });

    await expect(handler(event)).rejects.toThrow(/already taken/i);
    await deleteTestUser(testUser!.id);
  });

  it('should reject invalid email', async () => {
    const event = createMockEvent('', { email: 'not-an-email', password: 'password123', username: `u_${Date.now()}` });
    await expect(handler(event)).rejects.toThrow(/Invalid email/i);
  });

  it('should reject short password', async () => {
    const event = createMockEvent('', { email: `a@b.com`, password: '123', username: `u_${Date.now()}` });
    await expect(handler(event)).rejects.toThrow(/Too small/i);
  });
});
