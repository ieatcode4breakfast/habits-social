import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, db } from './test.utils';
import { userBlocks } from '../db/schema';

describe('GET /api/users/[id]/profile', () => {
  let handler: any;
  let testUser: any;
  let targetUser: any;

  beforeAll(async () => {
    handler = (await import('../api/users/[id]/profile.get')).default;
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

  it('should reject malformed profile ID (DB-enforced UUID per Note #11)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, { id: 'not-a-user-id' });
    await expect(handler(event)).rejects.toThrow();
  });

  it('should hide blocker profile from the blocked user', async () => {
    await db.insert(userBlocks).values({
      blockerId: targetUser.id,
      blockedId: testUser.id,
      createdAt: new Date()
    });

    const event = createMockEvent(testUser.id, {}, {}, { id: targetUser.id });
    await expect(handler(event)).rejects.toThrow(/User not found/i);
  });

  it('should allow the blocker to view the blocked user profile', async () => {
    const event = createMockEvent(targetUser.id, {}, {}, { id: testUser.id });
    const response = await handler(event);

    expect(response.data.id).toBe(testUser.id);
    expect(response.data.email).toBeUndefined();
  });
});
