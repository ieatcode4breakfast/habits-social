import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, generateMassiveString } from './test.utils';

describe('GET /api/v2/users/search', () => {
  let handler: any;
  let testUser: any;
  let searchTarget: any;

  beforeAll(async () => {
    handler = (await import('../users/search.get')).default;
    testUser = await createTestUser(`searcher_${Date.now()}`, `searcher_${Date.now()}@ex.com`);
    searchTarget = await createTestUser(`target_${Date.now()}`, `target_${Date.now()}@ex.com`);
  });

  afterAll(async () => {
    await deleteTestUser(testUser.id);
    await deleteTestUser(searchTarget.id);
  });

  it('should find user by username and NOT return email (PRR-2)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { username: searchTarget.username });
    const response = await handler(event);

    expect(response.data).toBeDefined();
    expect(response.data.length).toBeGreaterThan(0);
    const found = response.data.find((u: any) => u.id === searchTarget.id);
    expect(found).toBeDefined();
    expect(found.username).toBe(searchTarget.username);
    expect(found.email).toBeUndefined(); // PRR-2 verification
  });

  it('should gracefully handle massively long username strings (PRR-13)', async () => {
    const massiveString = generateMassiveString(20000);
    const event = createMockEvent(testUser.id, {}, {}, {}, { username: massiveString });
    const response = await handler(event);

    expect(response.data).toBeDefined();
    // It should slice it and search, likely returning [] but not crashing 500
    expect(response.data).toEqual([]);
  });

  it('should gracefully handle non-string search params (PRR-13)', async () => {
    const event = createMockEvent(testUser.id, {}, {}, {}, { username: { nested: 'object' } });
    const response = await handler(event);

    expect(response.data).toBeDefined();
    expect(response.data).toEqual([]); // Should return early or handle it
  });
});
