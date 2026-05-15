import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../app/utils/db';
import { recalculateLocalBucketStreak } from '../app/utils/streaks';

const OWNER_ID = 'test-user-id';
const BUCKET_ID = 'bucket-1';

const d = (offset: number) => {
  const date = new Date('2024-05-01');
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0]!;
};

const seedBucket = async () => {
  await db.buckets.put({
    id: BUCKET_ID,
    ownerId: OWNER_ID,
    title: 'Test Bucket',
    description: '',
    color: '#6366f1',
    habitIds: ['h1', 'h2'],
    currentStreak: 0,
    longestStreak: 0,
    streakAnchorDate: null,
    synced: 1,
    updatedAt: Date.now()
  } as any);
};

const seedBucketLog = async (dayOffset: number, status: string, streakCount = 0) => {
  await db.bucketLogs.put({
    id: `${BUCKET_ID}_${d(dayOffset)}`,
    bucketId: BUCKET_ID,
    ownerId: OWNER_ID,
    date: d(dayOffset),
    status,
    streakCount,
    brokenStreakCount: 0,
    synced: 1,
    updatedAt: Date.now()
  } as any);
};

describe('recalculateLocalBucketStreak - Alignment with Habit Streak Logic', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedBucket();
  });

  it('should compute streak = 6 when cleared day exists in the middle (full recalc)', async () => {
    // Days 0-4: completed (streak = 5)
    for (let i = 0; i <= 4; i++) await seedBucketLog(i, 'completed');
    // Day 5: cleared (gap)
    await seedBucketLog(5, 'cleared');
    // Days 6-11: completed (streak = 6)
    for (let i = 6; i <= 11; i++) await seedBucketLog(i, 'completed');

    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID);
    expect(result?.currentStreak).toBe(6);
    expect(result?.longestStreak).toBe(6);
  });

  it('should compute streak = 6 when cleared day exists in the middle (incremental recalc)', async () => {
    // Days 0-4: completed with correct streakCounts
    for (let i = 0; i <= 4; i++) await seedBucketLog(i, 'completed', i + 1);
    // Day 5: cleared
    await seedBucketLog(5, 'cleared', 0);
    // Days 6-11: completed (streakCounts will be recalculated)
    for (let i = 6; i <= 11; i++) await seedBucketLog(i, 'completed', 0);

    // Recalculate incrementally from Day 5
    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID, d(5));
    expect(result?.currentStreak).toBe(6);
  });

  it('should NOT pick up stale streakCount from a cleared baseline log', async () => {
    // Scenario: A bucket log was originally 'completed' with streakCount=5,
    // then status changed to 'cleared' but streakCount wasn't reset.
    for (let i = 0; i <= 4; i++) await seedBucketLog(i, 'completed', i + 1);
    // Day 5: cleared BUT with stale streakCount = 5 (simulates the bug)
    await seedBucketLog(5, 'cleared', 5);
    // Days 6-7: completed
    await seedBucketLog(6, 'completed', 0);
    await seedBucketLog(7, 'completed', 0);

    // Incremental recalc from Day 6 — should NOT inherit streakCount=5 from Day 5
    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID, d(6));
    // Expected: streak = 2 (Days 6-7), NOT 7 (5 + 2)
    expect(result?.currentStreak).toBe(2);
  });

  it('should break streak on failed bucket log', async () => {
    for (let i = 0; i <= 2; i++) await seedBucketLog(i, 'completed');
    await seedBucketLog(3, 'failed');
    await seedBucketLog(4, 'completed');

    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID);
    expect(result?.currentStreak).toBe(1);
    expect(result?.longestStreak).toBe(3);
  });

  it('should protect streak on vacation/skipped bucket log', async () => {
    await seedBucketLog(0, 'completed');
    await seedBucketLog(1, 'completed');
    await seedBucketLog(2, 'vacation');
    await seedBucketLog(3, 'skipped');
    await seedBucketLog(4, 'completed');

    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID);
    expect(result?.currentStreak).toBe(3);
  });

  it('should persist streakAnchorDate in no-logs fallback branch', async () => {
    // Seed a bucket with an existing streakAnchorDate
    await db.buckets.update(BUCKET_ID, { streakAnchorDate: d(2), currentStreak: 3 });

    // Seed prevLogs that establish a baseline
    await seedBucketLog(0, 'completed', 1);
    await seedBucketLog(1, 'completed', 2);
    await seedBucketLog(2, 'completed', 3);

    // Incremental recalc from Day 10 with NO logs from Day 10 onward
    const result = await recalculateLocalBucketStreak(BUCKET_ID, OWNER_ID, d(10));
    // Should preserve the baseline's anchor and streak
    expect(result?.currentStreak).toBe(3);
    expect(result?.streakAnchorDate).toBe(d(2));
  });
});
