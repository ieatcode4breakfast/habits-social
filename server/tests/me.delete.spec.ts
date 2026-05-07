import './setup';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('DELETE /api/users/me', () => {
  let testUser: any;
  let handler: any;

  beforeAll(async () => {
    testUser = await createTestUser(`t_del_${Date.now() % 1000000}`, `d_${Date.now()}@ex.com`);
    handler = (await import('../api/users/me.delete')).default;
  });

  afterAll(async () => {
    // Usually already deleted by the test, but cleanup just in case
    try {
      if (testUser?.id) await deleteTestUser(testUser.id);
    } catch {}
  });

  it('should delete the user successfully', async () => {
    const event = createMockEvent(testUser.id);
    event.context.userId = testUser.id;

    const response = (await handler(event)) as any;
    expect(response.message).toBe('User deleted successfully');
    expect(response.data!.id).toBe(testUser.id);
  });

  it('should throw 404 if user already deleted', async () => {
    const event = createMockEvent(testUser.id);
    event.context.userId = testUser.id;

    await expect(handler(event)).rejects.toThrow('User not found');
  });
});
