import { parseISO, startOfDay } from 'date-fns';
import { db } from './db';
import type { LocalHabit, LocalBucket } from './db';
import { calculateStreakFromLogs } from '../../utils/habits';


// Helper to port logic
export const recalculateLocalHabitStreak = async (habitId: string, ownerId: string, fromDate?: string) => {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let maxStreak = 0;
  let baselineAnchor: string | null = null;

  // Fetch all logs from IndexedDB
  const logs = await db.habitLogs
    .where('ownerId').equals(ownerId)
    .filter(l => l.habitId === habitId)
    .toArray();
    
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) {
    if (habit.currentStreak !== 0 || habit.streakAnchorDate !== null) {
      await db.habits.update(habitId, {
        currentStreak: 0,
        streakAnchorDate: null,
        updatedAt: Date.now()
      });
      return await db.habits.get(habitId);
    }
    return habit;
  }

  // 3. Use shared logic for calculation from the beginning of time
  let { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    logs,
    runningStreak,
    lastDate,
    maxStreak,
    baselineAnchor
  );

  // 4. Update child logs (already diffed in calculateStreakFromLogs)
  if (logUpdates.length > 0) {
    for (const u of logUpdates) {
      await db.habitLogs.update(u.id, {
        streakCount: u.streakCount,
        brokenStreakCount: u.brokenStreakCount,
        updatedAt: Date.now()
      } as any);
    }
  }

  // 5. Final Habit Update (Diff-checked to save updates I/O)
  if (
    habit.currentStreak !== currentStreak ||
    habit.longestStreak !== longestStreak ||
    habit.streakAnchorDate !== streakAnchorDate
  ) {
    await db.habits.update(habitId, {
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: Date.now()
    });
    return await db.habits.get(habitId);
  }

  return habit;
};


export const recalculateLocalBucketStreak = async (bucketId: string, ownerId: string, fromDate?: string) => {
  const bucket = await db.buckets.get(bucketId);
  if (!bucket) return;

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let maxStreak = 0;
  let baselineAnchor: string | null = null;

  // Fetch all logs from IndexedDB
  const logs = await db.bucketLogs
    .where('ownerId').equals(ownerId)
    .filter(l => l.bucketId === bucketId)
    .toArray();
    
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) {
    if (bucket.currentStreak !== 0 || bucket.streakAnchorDate !== null) {
      await db.buckets.update(bucketId, {
        currentStreak: 0,
        streakAnchorDate: null,
        updatedAt: Date.now()
      });
      return await db.buckets.get(bucketId);
    }
    return bucket;
  }

  // 3. Use shared logic for calculation from the beginning of time
  const { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    logs,
    runningStreak,
    lastDate,
    maxStreak,
    baselineAnchor
  );

  // 4. Update child logs (already diffed in calculateStreakFromLogs)
  if (logUpdates.length > 0) {
    for (const u of logUpdates) {
      await db.bucketLogs.update(u.id, {
        streakCount: u.streakCount,
        brokenStreakCount: u.brokenStreakCount,
        updatedAt: Date.now()
      } as any);
    }
  }

  // 5. Final Bucket Update (Diff-checked to save updates I/O)
  if (
    bucket.currentStreak !== currentStreak ||
    bucket.longestStreak !== longestStreak ||
    bucket.streakAnchorDate !== streakAnchorDate
  ) {
    await db.buckets.update(bucketId, {
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      streakAnchorDate: streakAnchorDate,
      updatedAt: Date.now()
    });
    return await db.buckets.get(bucketId);
  }

  return bucket;
};
