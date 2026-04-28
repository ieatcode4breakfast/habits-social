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

    // Rule 1.1: Initial Completion (Day 1)
    if (log.status === 'completed' && log.streakCount === 1) {
      type = 'INITIAL_COMPLETION';
      message = `completed ${log.habitTitle} for ${dateFormatted}.`;
    } 
    // Rule 1.2: Initial Skip
    else if (log.status === 'skipped' && log.streakCount === 0) {
      type = 'INITIAL_SKIP';
      message = `skipped ${log.habitTitle} for ${dateFormatted}.`;
    } 
    // Rule 1.3: Initial Failure
    else if (log.status === 'failed' && log.streakCount === 0 && (log.brokenStreakCount || 0) === 0) {
      type = 'INITIAL_FAILURE';
      message = `failed ${log.habitTitle} for ${dateFormatted}.`;
    }

    // --- CATEGORY 2: STREAK DYNAMICS ---

    // Trigger 2.1: Started a Streak (Day 2)
    else if (log.status === 'completed' && log.streakCount === 2) {
      type = 'STREAK_STARTED';
      message = `started a streak by completing ${log.habitTitle} for ${dateFormatted}. That’s 2 in row!`;
    }
    // Trigger 2.2: Day 3 & Day 4 Completion
    else if (log.status === 'completed' && (log.streakCount === 3 || log.streakCount === 4)) {
      type = 'STREAK_CONTINUED';
      message = `hit a ${log.streakCount}-day streak by completing ${log.habitTitle} for ${dateFormatted}.`;
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
