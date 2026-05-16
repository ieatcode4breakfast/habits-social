import './setup';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncService } from '../services/sync.service';
import { 
  createTestUser, 
  createTestHabit, 
  createTestHabitLog, 
  createTestDeletion,
  db 
} from './test.utils';
import { sql, inArray, eq } from 'drizzle-orm';
import { habits as habitsTable, users } from '../db/schema';

describe('Sync V2: Paginated Sync', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`sync_v2_${Date.now()}`, `v2_${Date.now()}@example.com`);
  });

  afterEach(async () => {
    if (testUser?.id) {
      await db.delete(habitsTable).where(eq(habitsTable.ownerId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });


  describe('Pagination & Cursors', () => {
    it('should paginate habits correctly and return a dictionary cursor', { timeout: 30000 }, async () => {
      // Create 15 habits
      for (let i = 0; i < 15; i++) {
        await createTestHabit(testUser.id, `Habit ${i}`);
      }

      // First Page
      const res1 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { limit: 10 });
      expect(res1.habits).toHaveLength(10);
      expect(res1.hasMore).toBe(true);
      expect(res1.nextCursors.habits).toBeDefined();

      // Second Page
      const res2 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { 
        limit: 10, 
        cursors: { habits: res1.nextCursors.habits } 
      });
      expect(res2.habits).toHaveLength(5);
      expect(res2.hasMore).toBe(false);
    });

    it('should handle timestamp collisions using the ID fallback', { timeout: 30000 }, async () => {
      const now = new Date();
      // Force two habits to have the exact same updatedAt
      const h1 = await createTestHabit(testUser.id, 'Collision 1');
      const h2 = await createTestHabit(testUser.id, 'Collision 2');
      
      await db.update(habitsTable).set({ updatedAt: now }).where(inArray(habitsTable.id, [h1.id, h2.id]));

      // Page 1 with limit 1
      const res1 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { limit: 1 });
      expect(res1.habits).toHaveLength(1);
      
      // Page 2
      const res2 = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { 
        limit: 1, 
        cursors: { habits: res1.nextCursors.habits } 
      });
      expect(res2.habits).toHaveLength(1);
      expect(res2.habits[0].id).not.toBe(res1.habits[0].id);
    });
  });

  describe('Topological Integrity (Parent-First Suppression)', () => {
    it('should suppress logs if parent habits have more data pending', async () => {
      const h1 = await createTestHabit(testUser.id, 'Parent Habit 1');
      const h2 = await createTestHabit(testUser.id, 'Parent Habit 2');
      await createTestHabitLog(testUser.id, h1.id, '2024-01-01');

      // Request with limit 1 for habits. Since there are 2 habits, hasMore will be true.
      const res = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { 
        limit: 1 
      });

      expect(res.habits).toHaveLength(1);
      expect(res.habitLogs).toHaveLength(0); // Suppressed!
      expect(res.hasMore).toBe(true);
    });
  });

  describe('Massive Account Load Test', () => {
    it('should successfully drain 100 items via recursive pagination', { timeout: 30000 }, async () => {
      const totalItems = 100;
      const values = [];
      const baseTime = Math.floor(Date.now() / 1000) * 1000;
      for (let i = 0; i < totalItems; i++) {
        values.push({
          id: crypto.randomUUID(),
          ownerId: testUser.id,
          title: `Load Habit ${i}`,
          updatedAt: new Date(baseTime + i * 1000) // Ensure different timestamps at second precision
        });
      }
      await db.insert(habitsTable).values(values);

      let syncedCount = 0;
      let currentCursors: any = {};
      let hasMore = true;
      let iterations = 0;

      while (hasMore && iterations < 10) {
        iterations++;
        const res = await (SyncService as any).getPaginatedDeltas(db, testUser.id, { 
          limit: 20, 
          cursors: currentCursors 
        });
        syncedCount += res.habits.length;
        currentCursors = res.nextCursors;
        hasMore = res.hasMore;
      }

      expect(syncedCount).toBe(totalItems);
    });
  });
});
