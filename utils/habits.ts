import { parseISO, startOfDay, differenceInDays } from 'date-fns';

export interface HabitLogLike {
  id?: string;
  date: string;
  status: string;
  streakCount?: number;
  brokenStreakCount?: number;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  streakAnchorDate: string | null;
  logUpdates: Array<{
    id: string;
    streakCount: number;
    brokenStreakCount: number;
  }>;
}

/**
 * Pure function to calculate streaks from a sorted array of logs.
 * This is the single source of truth for streak calculation logic across client and server.
 */
export function calculateStreakFromLogs(
  logs: HabitLogLike[],
  initialRunningStreak = 0,
  initialLastDate: Date | null = null,
  initialMaxStreak = 0,
  initialStreakAnchorDate: string | null = null
): StreakResult {
  let runningStreak = initialRunningStreak;
  let lastDate = initialLastDate;
  let maxStreak = initialMaxStreak;
  let streakAnchorDate = initialStreakAnchorDate;
  const logUpdates: StreakResult['logUpdates'] = [];

  for (const log of logs) {
    const currentDate = startOfDay(parseISO(log.date));

    // Check for gap (more than 1 day between logs)
    if (log.status !== 'cleared' && lastDate) {
      const diff = differenceInDays(currentDate, lastDate);
      if (diff > 1) {
        runningStreak = 0; // Gap detected, reset streak
      }
    }

    let brokenStreakCount = 0;
    if (log.status === 'completed') {
      runningStreak++;
    } else if (log.status === 'failed') {
      brokenStreakCount = runningStreak;
      runningStreak = 0;
    } else if (log.status === 'skipped' || log.status === 'vacation') {
      // Streak remains intact (protected)
    } else if (log.status === 'cleared') {
      // Invalidate anchor if this cleared log was the anchor
      if (streakAnchorDate === log.date) {
        streakAnchorDate = null;
      }
      continue; // Transparent: Don't update runningStreak or lastDate
    }

    maxStreak = Math.max(maxStreak, runningStreak);

    // The anchor is the most recent log date with a valid status
    if (['completed', 'failed', 'skipped', 'vacation'].includes(log.status)) {
      streakAnchorDate = log.date;
    }

    // Only queue update if the log values would actually change
    if (log.id && (log.streakCount !== runningStreak || log.brokenStreakCount !== brokenStreakCount)) {
      logUpdates.push({
        id: log.id,
        streakCount: runningStreak,
        brokenStreakCount: brokenStreakCount
      });
    }

    lastDate = currentDate;
  }

  return {
    currentStreak: runningStreak,
    longestStreak: maxStreak,
    streakAnchorDate,
    logUpdates
  };
}
