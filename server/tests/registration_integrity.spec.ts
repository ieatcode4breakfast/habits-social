import './setup';
import { describe, it, expect, afterAll, vi } from 'vitest';
import { db, createMockEvent } from './test.utils';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('Registration Integrity (Race Condition Protection)', () => {
  const testEmail = `integrity_${Date.now()}@test.com`;
  const testUsername = `Intg_${Date.now() % 1000000}`;

  afterAll(async () => {
    // Cleanup
    await db.delete(users).where(eq(users.email, testEmail));
    await db.delete(users).where(eq(users.username, testUsername));
  });

  it('PROVE THE BUG: Database should block duplicates directly (this will FAIL initially)', async () => {
    const userData = {
      id: crypto.randomUUID(),
      email: testEmail,
      username: testUsername,
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // First insert succeeds
    await db.insert(users).values(userData);

    // Second insert with same email SHOULD fail at DB level
    // Currently, this will NOT throw an error because the unique constraint is missing
    const duplicateData = {
      ...userData,
      id: crypto.randomUUID(), // Different ID, same email
    };

    await expect(db.insert(users).values(duplicateData)).rejects.toThrow();
  });

  it('API SHOULD handle race conditions: return 409 when DB blocks concurrent registration', async () => {
    const handler = (await import('../api/auth/register.post')).default;
    
    const email = `race_${Date.now()}@test.com`;
    const username = `Race_${Date.now() % 1000000}`;

    // 1. Manually insert the user to simulate another request finishing first
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      username,
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 2. Prepare the event
    const event = createMockEvent('', { email, password: 'password123', username });

    // 3. Mock the DB's select call to return empty (simulating the race condition where the select check passes)
    // We want to force the code to reach the insert step
    const originalSelect = db.select;
    const selectMock = vi.spyOn(db, 'select').mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]) // Pass the check!
        })
      })
    } as any);

    // 4. Call handler - it should hit the DB's unique constraint and return 409
    try {
      await handler(event);
      throw new Error('Should have thrown 409');
    } catch (e: any) {
      expect(e.statusCode).toBe(409);
      expect(e.statusMessage).toMatch(/already taken/i);
    } finally {
      selectMock.mockRestore();
      // Cleanup
      await db.delete(users).where(eq(users.email, email));
    }
  });
});
