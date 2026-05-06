import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent } from './test.utils';

describe('GET /api/v2/users/[id]/profile', () => {
  let handler: any;
  let testUser: any;
  let targetUser: any;

  beforeAll(async () => {
    handler = (await import('../users/[id]/profile.get')).default;
    testUser = await createTestUser(`viewer_${Date.now()}`, `viewer_${Date.now()}@ex.com`);
    targetUser = await createTestUser(`profile_${Date.now()}`, `profile_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    await deleteTestUser(testUser.id);
    await deleteTestUser(targetUser.id);
  });

  it('should fetch user profile and NOT return email (PRR-2)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, { id: targetUser.id });
    const response = await handler(event);

    expect(response.data).toBeDefined();
    expect(response.data.id).toBe(targetUser.id);
    expect(response.data.username).toBe(targetUser.username);
    expect(response.data.email).toBeUndefined(); // PRR-2 validation
  });

  it('should return 404 for invalid profile ID', async () => {
    const event = createMockEvent(testUser.id, {}, {}, { id: '00000000-0000-0000-0000-000000000000' });
    await expect(handler(event)).rejects.toThrow(/User not found/i);
  });
});
