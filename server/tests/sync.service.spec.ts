import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../services/sync.service';
import { createTestUser, createTestHabit, createTestBucket, deleteTestUser, db } from './test.utils';
import { useDB } from '../utils/db';

describe('SyncService', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser(`sync_user_${Date.now()}`, `sync_${Date.now()}@example.com`);
  });

  it('should return empty deltas for a new user with lastSynced=0', async () => {
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: 0 });
    expect(res.habits).toHaveLength(0);
    expect(res.buckets).toHaveLength(0);
    expect(res.habitLogs).toHaveLength(0);
    expect(res.serverTime).toBeGreaterThan(0);
  });

  it('should return new habits created after lastSynced', async () => {
    const lastSynced = Date.now() - 10000;
    await createTestHabit(testUser.id, 'New Habit');
    
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced });
    expect(res.habits).toHaveLength(1);
    expect(res.habits[0].title).toBe('New Habit');
  });

  it('should handle extreme future lastSynced dates gracefully', async () => {
    const futureDate = Date.now() + 10000000;
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: futureDate });
    expect(res.habits).toHaveLength(0);
  });

  it('should handle negative lastSynced by treating it as 0', async () => {
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: -100 });
    expect(res.serverTime).toBeGreaterThan(0);
  });

  it('should optimize bucket metadata and avoid crashes on empty state', async () => {
    // This test ensures the inArray logic doesn't crash
    const res = await SyncService.getDeltas(db, testUser.id, { lastSynced: 0 });
    expect(res.buckets).toHaveLength(0);
  });
});
