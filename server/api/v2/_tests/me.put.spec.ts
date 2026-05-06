import './setup';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('PUT /api/v2/users/me', () => {
  let testUser: any;
  let otherUser: any;
  let handler: any;

  beforeAll(async () => {
    testUser = await createTestUser(`t_put_${Date.now() % 1000000}`, `p_${Date.now()}@ex.com`);
    otherUser = await createTestUser(`o_put_${Date.now() % 1000000}`, `op_${Date.now()}@ex.com`);
    handler = (await import('../users/me.put')).default;
  });

  afterAll(async () => {
    if (testUser?.id) await deleteTestUser(testUser.id);
    if (otherUser?.id) await deleteTestUser(otherUser.id);
  });

  it('should update username successfully', async () => {
    const newUsername = `upd_${Date.now() % 1000000}`; // Shorter to fit max 20
    const event = createMockEvent(testUser.id, { username: newUsername });
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data!.username).toBe(newUsername);
    testUser.username = newUsername; // Update local ref for subsequent tests
  });

  it('should update email and reset emailVerifiedAt', async () => {
    const newEmail = `n${Date.now()}@ex.com`;
    const event = createMockEvent(testUser.id, { email: newEmail });
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data!.email).toBe(newEmail);
    expect(response.data!.emailVerifiedAt).toBeNull();
    testUser.email = newEmail;
  });

  it('should throw 409 if username is taken', async () => {
    const event = createMockEvent(testUser.id, { username: otherUser.username });
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/username is already taken/i);
  });

  it('should throw 409 if username is taken case-insensitively', async () => {
    const event = createMockEvent(testUser.id, { username: otherUser.username.toUpperCase() });
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/username is already taken/i);
  });

  it('should validate reachable avatar URLs', async () => {
    // DiceBear URL is reachable
    const dicebearUrl = 'https://api.dicebear.com/9.x/avataaars/svg?seed=test';
    const event = createMockEvent(testUser.id, { photourl: dicebearUrl });
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data!.photourl).toBe(dicebearUrl);
  });

  it('should reject invalid avatar URL formats', async () => {
    const invalidUrl = 'not-a-valid-url';
    const event = createMockEvent(testUser.id, { photourl: invalidUrl });
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/Invalid URL/i);
  });

  it('should allow clearing avatar with empty string', async () => {
    const event = createMockEvent(testUser.id, { photourl: '' });
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.data!.photourl).toBe('');
  });

  it('should reject empty update body', async () => {
    const event = createMockEvent(testUser.id, {});
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow(/At least one field must be provided/i);
  });
});

