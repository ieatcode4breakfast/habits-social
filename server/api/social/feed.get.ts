import { format, parseISO } from 'date-fns';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  // 1. Get friend IDs (only accepted friendships)
  const friendships = await sql`
    SELECT "initiatorId", "receiverId"
    FROM friendships 
    WHERE ("initiatorId" = ${userId} OR "receiverId" = ${userId}) 
      AND status = 'accepted'
  `;

  const friendIds = friendships.map(f => f.initiatorId === userId ? f.receiverId : f.initiatorId);

  // If no friends, return empty feed (or just user's own activity? For now, following plan: friends only)
  if (friendIds.length === 0) return [];

  // 2. Query logs with metadata and visibility filtering
  // We join with habits to check current visibility (sharedwith) and get title/color
  // We join with users to get actor details
  const logs = await sql`
    SELECT 
      l.*, 
      h.title as "habitTitle", 
      h."longestStreak",
      u.username, 
      u.photourl
    FROM habitlogs l
    JOIN habits h ON l.habitid::uuid = h.id
    JOIN users u ON l.ownerid::uuid = u.id
    WHERE (l.ownerid::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.sharedwith))
      OR (l.ownerid::text = ${userId}::text)
    ORDER BY l.date DESC, l.updatedat DESC, l.id DESC
    LIMIT 100
  `;

  // 3. The "Narrator" Logic (Category 1: Initial & Isolated Logs)
  // For now, we only filter and map Category 1 triggers as requested.
  const feed = logs.map(log => {
    let type = '';
    let message = '';

    const dateFormatted = format(parseISO(log.date), 'MMM d');

    // Helper functions and constants for Category 2
    const formatStreak = (days: number) => {
      if (days < 365) return `${days}-day streak`;
      const years = Math.floor(days / 365);
      const rem = days % 365;
      const yt = years === 1 ? '1-year' : `${years}-year`;
      if (rem === 0) return `${yt} streak (${days} days)`;
      return `${yt} and ${rem}-day streak (${days} days)`;
    };
    const formatExtensionDuration = (days: number) => {
      if (days < 365) return `${days} days`;
      const years = Math.floor(days / 365);
      const rem = days % 365;
      const yt = years === 1 ? '1-year' : `${years}-year`;
      if (rem === 0) return `${yt} (${days} days)`;
      const dt = rem === 1 ? '1 day' : `${rem} days`;
      return `${yt} and ${dt} (${days} days)`;
    };
    const pronoun = log.ownerid === userId ? 'your' : 'their';
    const isVeteran = (log.streakCount || 0) >= 365;
    const milestones = [5, 7, 14, 21, 30, 60, 90, 100, 180, 300];

    // Rule 1.1: Initial Completion (Day 1)
    if (log.status === 'completed' && log.streakCount === 1) {
      type = 'INITIAL_COMPLETION';
      message = `completed ${log.habitTitle} for ${dateFormatted}.`;
    }
    // Rule 1.2: Initial Skip
    else if (log.status === 'skipped' && log.streakCount <= 1) {
      type = 'INITIAL_SKIP';
      message = `skipped ${log.habitTitle} for ${dateFormatted}.`;
    }
    // Rule 1.3: Initial Failure
    else if (log.status === 'failed' && log.streakCount === 0 && (log.brokenStreakCount || 0) <= 1) {
      type = 'INITIAL_FAILURE';
      message = `failed ${log.habitTitle} for ${dateFormatted}.`;
    }

    // --- CATEGORY 2: STREAK DYNAMICS ---
    else if (log.status === 'completed' && log.streakCount > 1) {
      const isAnnual = log.streakCount % 365 === 0;
      const rem = log.streakCount % 365;

      // Trigger 2.1: Started a Streak (Day 2)
      if (log.streakCount === 2 && !isVeteran) {
        type = 'STREAK_STARTED';
        message = `started a streak by completing ${log.habitTitle} for ${dateFormatted}. That’s 2 in row!`;
      }
      // Trigger 2.2: Day 3 & Day 4 Completion
      else if ((log.streakCount === 3 || log.streakCount === 4) && !isVeteran) {
        type = 'STREAK_CONTINUED';
        message = `hit a ${log.streakCount}-day streak by completing ${log.habitTitle} for ${dateFormatted}.`;
      }
      // Trigger 2.5: Annual Anniversary
      else if (isAnnual) {
        type = 'ANNUAL_ANNIVERSARY';
        message = `hit a ${formatStreak(log.streakCount)} by completing ${log.habitTitle} for ${dateFormatted}!`;
      }
      // Trigger 2.4: Streak Milestone Reached
      else if (log.streakCount < 365 && milestones.includes(log.streakCount)) {
        if (!(isVeteran && log.streakCount === 5)) {
          type = 'STREAK_MILESTONE';
          message = `hit a ${log.streakCount}-day streak by completing ${log.habitTitle} for ${dateFormatted}!`;
        }
      }
      // Trigger 2.6: Post-Year Milestone Reached
      else if (log.streakCount > 365 && rem >= 7 && milestones.includes(rem)) {
        type = 'POST_YEAR_MILESTONE';
        message = `hit a ${formatStreak(log.streakCount)} by completing ${log.habitTitle} for ${dateFormatted}!`;
      }
      // Extension logic
      else if (log.streakCount > 4 || (isVeteran && log.streakCount >= 2)) {
        if (log.streakCount > 365) {
          // Trigger 2.8: Post-Year Standard Streak Extension
          type = 'POST_YEAR_EXTENSION';
          message = `completed ${log.habitTitle} for ${dateFormatted}—extending ${pronoun} streak to ${formatExtensionDuration(log.streakCount)}!`;
        } else {
          // Trigger 2.7: Standard Streak Extension
          type = 'STREAK_EXTENSION';
          message = `completed ${log.habitTitle} for ${dateFormatted}—extending ${pronoun} streak to ${log.streakCount} days!`;
        }
      }
    }
    // Trigger 2.3: Streak Broken (Fail/Miss)
    else if (log.status === 'failed' && (log.brokenStreakCount || 0) > 1) {
      type = 'STREAK_BROKEN';
      message = `failed ${log.habitTitle} for ${dateFormatted}, bringing ${pronoun} ${formatStreak(log.brokenStreakCount as number)} to an end.`;
    }
    // Trigger 2.9: Streak Maintained (Skip)
    else if (log.status === 'skipped' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED';
      message = `skipped ${log.habitTitle} for ${dateFormatted}; ${pronoun} ${formatStreak(log.streakCount)} remains intact.`;
    }

    // Only return if it matched a trigger
    if (type) {
      return {
        id: log.id,
        type,
        user: {
          id: log.ownerid,
          name: log.ownerid === userId ? 'You' : log.username,
          photoUrl: log.photourl
        },
        habit: {
          id: log.habitid,
          title: log.habitTitle
        },
        message,
        date: log.date,
        timestamp: log.updatedat
      };
    }
    return null;
  }).filter(Boolean);

  return feed;
});
