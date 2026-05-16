import './setup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore - File may not exist yet
import syncBulk from '../api/sync/bulk.post';
import { createMockEvent, createTestUser, createTestHabit, db } from './test.utils';
import { habits as habitsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('API: POST /api/sync/bulk', () => {
  let testUser: any;
  let otherUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`bulk_sync_${Date.now()}`, `bulk_sync_${Date.now()}@example.com`);
    otherUser = await createTestUser(`bulk_sync_other_${Date.now()}`, `bulk_sync_other_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, otherUser.id));
      const { users } = await import('../db/schema');
      await db.delete(users).where(eq(users.id, testUser.id));
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
  });

  it('should reject payloads with more than 100 items', async () => {
    const operations = Array.from({ length: 101 }, (_, i) => ({
      type: 'habit',
      data: { id: `h${i}`, title: `Habit ${i}` }
    }));

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    try {
      await syncBulk(event);
      expect.fail('Should have thrown 400/413');
    } catch (e: any) {
      expect(e.statusCode).toBe(400); // or 413
      expect(e.statusMessage).toContain('Too big');
    }
  });

  it('should reject items belonging to another user (Zero-Trust)', async () => {
    const otherHabit = await createTestHabit(otherUser.id, 'Other User Habit');

    const operations = [
      {
        type: 'habit',
        data: { id: otherHabit.id, title: 'I am stealing this' }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);
    
    // Expect the item to be failed in the response or the whole batch rejected
    // The plan says "results in that specific item being rejected (or the whole batch rejected)"
    // Let's assume partial failure response structure: { success: [], failed: [...] }
    expect(response.failed.length).toBe(1);
    expect(response.failed[0]?.id).toBe(otherHabit.id);
  });

  it('should fail child entities if parent entity fails (Cascading Failure)', async () => {
    const invalidHabitId = crypto.randomUUID();
    const operations = [
      {
        type: 'habit',
        data: { id: invalidHabitId, title: '' } // This should fail validation
      },
      {
        type: 'log',
        data: { id: 'l1', habitId: invalidHabitId, date: '2026-01-01', status: 'completed' } // Dependent on the failed habit
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.failed.length).toBe(2);
    // Find the log failure
    const logFailure = response.failed.find((f: any) => f.id === 'l1');
    expect(logFailure).toBeTruthy();
    expect(logFailure?.code).toBe('DEPENDENCY_FAILED');
  });

  it('should successfully process valid operations', async () => {
    const operations = [
      {
        type: 'habit',
        data: { id: crypto.randomUUID(), title: 'Bulk Habit' }
      }
    ];

    const event = createMockEvent(testUser.id, { operations }, {}, {}, {}, 'POST');

    const response = await syncBulk(event);

    expect(response.success.length).toBe(1);
    expect(response.failed.length).toBe(0);
  });
});
