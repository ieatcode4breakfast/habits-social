import './setup';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncService } from '../services/sync.service';
import { 
  createTestUser, 
  createTestHabit, 
  createTestHabitLog, 
  db 
} from './test.utils';
import { inArray } from 'drizzle-orm';
import { habits as habitsTable } from '../db/schema';

describe('Sync V2: Pagination & Integrity', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`sync_pagination_${Date.now()}`, `pagination_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      const { eq } = await import('drizzle-orm');
      const { users } = await import('../db/schema');
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });


  describe('Topological Suppression', () => {
    it('should NOT return habit logs if parent habits have more pages pending', async () => {
      // Create 3 habits and 1 log for the first habit
      const h1 = await createTestHabit(testUser.id, 'Habit 1');
      await createTestHabit(testUser.id, 'Habit 2');
      await createTestHabit(testUser.id, 'Habit 3');
      await createTestHabitLog(testUser.id, h1.id, '2024-01-01');

      // Request with limit 2. habitsHasMore will be true.
      const res = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { limit: 2 });

      expect(res.habits).toHaveLength(2);
      expect(res.hasMore).toBe(true);
      expect(res.habitLogs).toHaveLength(0); // Suppressed because habits are not fully drained
    });
  });

  describe('ID-based Tie-breaking', () => {
    it('should maintain stable order when multiple items have identical timestamps', async () => {
      const now = new Date();
      const h1 = await createTestHabit(testUser.id, 'Tie 1');
      const h2 = await createTestHabit(testUser.id, 'Tie 2');
      
      // Force identical timestamps
      await db.update(habitsTable).set({ updatedAt: now }).where(inArray(habitsTable.id, [h1.id, h2.id]));

      // Fetch page 1 with limit 1
      const res1 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { limit: 1 });
      expect(res1.habits).toHaveLength(1);
      const firstId = res1.habits[0].id;

      // Fetch page 2 using cursor from page 1
      const res2 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { 
        limit: 1, 
        cursors: { habits: res1.nextCursors.habits } 
      });

      expect(res2.habits).toHaveLength(1);
      expect(res2.habits[0].id).not.toBe(firstId);
      
      // Verify both were returned across two pages
      const allIds = [res1.habits[0].id, res2.habits[0].id];
      expect(allIds).toContain(h1.id);
      expect(allIds).toContain(h2.id);
    });
  });
});
