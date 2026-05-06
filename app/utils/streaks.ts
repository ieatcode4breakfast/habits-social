import { parseISO, startOfDay, differenceInDays } from 'date-fns';
import { db } from './db';
import type { LocalHabit, LocalBucket } from './db';

// Helper to port logic
export const recalculateLocalHabitStreak = async (habitId: string, ownerId: string, fromDate?: string) => {
  const habit = await db.habits.get(habitId);
  if (!habit) return;

  let runningStreak = 0;
  let lastDate: Date | null = null;
  let queryStartDate = fromDate;

  if (fromDate) {
    const prevLogs = await db.habitLogs
      .where('ownerId').equals(ownerId)
      .filter(l => l.habitId === habitId && l.date < fromDate)
      .toArray();

    if (prevLogs.length > 0) {
      // sort desc
      prevLogs.sort((a, b) => b.date.localeCompare(a.date));
      const prevLog = prevLogs[0]!;
      runningStreak = prevLog.streakCount || 0;
      lastDate = startOfDay(parseISO(prevLog.date));
    }
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
      updatedAt: Date.now()
    });
    return await db.habits.get(habitId);
  }

  let maxStreak = habit.longestStreak || 0;
  let streakAnchorDate: string | null = habit.streakAnchorDate || null;
  const updates: any[] = [];

  for (const log of logs) {
    const currentDate = startOfDay(parseISO(log.date));
    
    if (lastDate) {
      const diff = differenceInDays(currentDate, lastDate);
      if (diff > 1) {
        runningStreak = 0; 
      }
    }
    
    let brokenStreakCount = 0;
    if (log.status === 'completed') {
      runningStreak++;
    } else if (log.status === 'failed') {
      brokenStreakCount = runningStreak;
      runningStreak = 0;
    } else if (log.status === 'skipped') {
      // intact
    } else if (log.status === 'cleared') {
      runningStreak = 0;
    }

    maxStreak = Math.max(maxStreak, runningStreak);
    
    if (['completed', 'failed', 'skipped', 'vacation'].includes(log.status)) {
      streakAnchorDate = log.date;
    }

    // Only update if changed
    if ((log as any).streakCount !== runningStreak || (log as any).brokenStreakCount !== brokenStreakCount) {
        updates.push({
            id: log.id,
            streakCount: runningStreak,
            brokenStreakCount: brokenStreakCount
        });
    }
    
    lastDate = currentDate;
  }

    if (updates.length > 0) {
      for (const u of updates) {
        await db.habitLogs.update(u.id, {
          streakCount: u.streakCount,
          brokenStreakCount: u.brokenStreakCount,
          updatedAt: Date.now()
        } as any);
      }
    }

  await db.habits.update(habitId, {
    currentStreak: runningStreak,
    longestStreak: maxStreak,
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

  let maxStreak = bucket.longestStreak || 0;
  let streakAnchorDate: string | null = bucket.streakAnchorDate || null;
  const updates: any[] = [];

  for (const log of logs) {
    const currentDate = startOfDay(parseISO(log.date));
    
    if (lastDate) {
      const diff = differenceInDays(currentDate, lastDate);
      if (diff > 1) {
        runningStreak = 0; 
      }
    }
    
    let brokenStreakCount = 0;
    if (log.status === 'completed') {
      runningStreak++;
    } else if (log.status === 'failed') {
      brokenStreakCount = runningStreak;
      runningStreak = 0;
    } else if (log.status === 'cleared') {
      runningStreak = 0;
    } 

    maxStreak = Math.max(maxStreak, runningStreak);
    
    if (['completed', 'failed', 'skipped', 'vacation'].includes(log.status)) {
      streakAnchorDate = log.date;
    }

    if ((log as any).streakCount !== runningStreak || (log as any).brokenStreakCount !== brokenStreakCount) {
      updates.push({
        id: log.id,
        streakCount: runningStreak,
        brokenStreakCount: brokenStreakCount
      });
    }
    
    lastDate = currentDate;
  }

  if (updates.length > 0) {
    for (const u of updates) {
      await db.bucketLogs.update(u.id, {
        streakCount: u.streakCount,
        brokenStreakCount: u.brokenStreakCount,
        updatedAt: Date.now()
      } as any);
    }
  }

  await db.buckets.update(bucketId, {
    currentStreak: runningStreak,
    longestStreak: maxStreak,
    streakAnchorDate: streakAnchorDate,
    updatedAt: Date.now()
  });

  return await db.buckets.get(bucketId);
};
