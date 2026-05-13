import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { db } from './db';
import type { LocalHabit, LocalBucket } from './db';

import { calculateStreakFromLogs } from '~~/utils/habits';


// Helper to port logic
export const recalculateLocalHabitStreak = async (habitId: string, ownerId: string, fromDate?: string) => {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;
  let maxStreak = 0;
  let baselineAnchor: string | null = habit.streakAnchorDate || null;

  // 2. If incremental, find the starting point state from the log just before fromDate
  if (fromDate) {
    const prevLogs = await db.habitLogs
      .where('ownerId').equals(ownerId)
      .filter(l => l.habitId === habitId && l.date < fromDate && l.status !== 'cleared')
      .toArray();

    if (prevLogs.length > 0) {
      // sort desc
      prevLogs.sort((a, b) => b.date.localeCompare(a.date));
      const prevLog = prevLogs[0]!;
      runningStreak = prevLog.streakCount || 0;
      lastDate = startOfDay(parseISO(prevLog.date));
      baselineAnchor = prevLog.date;
    }

    // Find max streak before fromDate
    const earlierLogs = await db.habitLogs
      .where('ownerId').equals(ownerId)
      .filter(l => l.habitId === habitId && l.date < fromDate && l.status !== 'cleared')
      .toArray();
    maxStreak = earlierLogs.reduce((max, l) => Math.max(max, l.streakCount || 0), 0);
  }

  const logs = await db.habitLogs
    .where('ownerId').equals(ownerId)
    .filter(l => l.habitId === habitId && (!queryStartDate || l.date >= queryStartDate))
    .toArray();
    
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) {
    if (!fromDate) {
      await db.habits.update(habitId, {
        currentStreak: 0,
        streakAnchorDate: null,
        updatedAt: Date.now()
      });
      return await db.habits.get(habitId);
    }

    await db.habits.update(habitId, {
      currentStreak: runningStreak,
      streakAnchorDate: baselineAnchor,
      updatedAt: Date.now()
    });
    return await db.habits.get(habitId);
  }

  // 4. Use shared logic for calculation
  let { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    logs,
    runningStreak,
    lastDate,
    maxStreak,
    baselineAnchor
  );

  if (logUpdates.length > 0) {
    for (const u of logUpdates) {
      await db.habitLogs.update(u.id, {
        streakCount: u.streakCount,
        brokenStreakCount: u.brokenStreakCount,
        updatedAt: Date.now()
      } as any);
    }
  }

  await db.habits.update(habitId, {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    streakAnchorDate: streakAnchorDate,
    updatedAt: Date.now()
  });

  return await db.habits.get(habitId);
};


export const recalculateLocalBucketStreak = async (bucketId: string, ownerId: string, fromDate?: string) => {
  const bucket = await db.buckets.get(bucketId);
  if (!bucket) return;

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;

  if (fromDate) {
    const prevLogs = await db.bucketLogs
      .where('ownerId').equals(ownerId)
      .filter(l => l.bucketId === bucketId && l.date < fromDate)
      .toArray();

    if (prevLogs.length > 0) {
      prevLogs.sort((a, b) => b.date.localeCompare(a.date));
      const prevLog = prevLogs[0]!;
      runningStreak = prevLog.streakCount || 0;
      lastDate = startOfDay(parseISO(prevLog.date));
    }
  }

  const logs = await db.bucketLogs
    .where('ownerId').equals(ownerId)
    .filter(l => l.bucketId === bucketId && (!queryStartDate || l.date >= queryStartDate))
    .toArray();
    
  logs.sort((a, b) => a.date.localeCompare(b.date));

  if (logs.length === 0) {
    if (!fromDate) {
      await db.buckets.update(bucketId, {
        currentStreak: 0,
        streakAnchorDate: null,
        updatedAt: Date.now()
      });
      return await db.buckets.get(bucketId);
    }
    
    await db.buckets.update(bucketId, {
      currentStreak: runningStreak,
      updatedAt: Date.now()
    });
    return await db.buckets.get(bucketId);
  }

  // 4. Use shared logic for calculation
  const { currentStreak, longestStreak, streakAnchorDate, logUpdates } = calculateStreakFromLogs(
    logs,
    runningStreak,
    lastDate,
    bucket.longestStreak || 0,
    bucket.streakAnchorDate || null
  );

  if (logUpdates.length > 0) {
    for (const u of logUpdates) {
      await db.bucketLogs.update(u.id, {
        streakCount: u.streakCount,
        brokenStreakCount: u.brokenStreakCount,
        updatedAt: Date.now()
      } as any);
    }
  }

  await db.buckets.update(bucketId, {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    streakAnchorDate: streakAnchorDate,
    updatedAt: Date.now()
  });

  return await db.buckets.get(bucketId);
};
