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

  // If no friends, only show user's own activity
  const hasFriends = friendIds.length > 0;

  // 2. Query habit logs (Categories 1 & 2)
  const logs = hasFriends ? await sql`
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
  ` : await sql`
    SELECT 
      l.*, 
      h.title as "habitTitle", 
      h."longestStreak",
      u.username, 
      u.photourl
    FROM habitlogs l
    JOIN habits h ON l.habitid::uuid = h.id
    JOIN users u ON l.ownerid::uuid = u.id
    WHERE l.ownerid::text = ${userId}::text
    ORDER BY l.date DESC, l.updatedat DESC, l.id DESC
    LIMIT 100
  `;

  // 3. Query habit commitments (Category 3 - Trigger 3.1)
  const commitments = hasFriends ? await sql`
    SELECT h.id, h.ownerid, h.user_date as date, h."createdAt" as updatedat,
           h.title as "habitTitle", h.sharedwith,
           u.username, u.photourl
    FROM habits h
    JOIN users u ON h.ownerid::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND (
        h.ownerid::text = ${userId}::text
        OR (h.ownerid::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.sharedwith))
      )
    ORDER BY h.user_date DESC, h."createdAt" DESC
    LIMIT 100
  ` : await sql`
    SELECT h.id, h.ownerid, h.user_date as date, h."createdAt" as updatedat,
           h.title as "habitTitle", h.sharedwith,
           u.username, u.photourl
    FROM habits h
    JOIN users u ON h.ownerid::uuid = u.id
    WHERE h.user_date IS NOT NULL
      AND h.ownerid::text = ${userId}::text
    ORDER BY h.user_date DESC, h."createdAt" DESC
    LIMIT 100
  `;

  // 4. Query share events (Category 3 - Trigger 3.2)
  const shareEvents = hasFriends ? await sql`
    SELECT se.id, se.ownerid, se.recipientid, se.habitids,
           se.user_date as date, se.created_at as updatedat,
           u.username, u.photourl,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.ownerid::uuid = u.id
    JOIN users ru ON se.recipientid::uuid = ru.id
    WHERE (
        (se.ownerid::text = ANY(${friendIds}) AND se.recipientid::text = ${userId}::text)
        OR se.ownerid::text = ${userId}::text
      )
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  ` : await sql`
    SELECT se.id, se.ownerid, se.recipientid, se.habitids,
           se.user_date as date, se.created_at as updatedat,
           u.username, u.photourl,
           ru.username as recipient_username
    FROM share_events se
    JOIN users u ON se.ownerid::uuid = u.id
    JOIN users ru ON se.recipientid::uuid = ru.id
    WHERE se.ownerid::text = ${userId}::text
    ORDER BY se.user_date DESC, se.created_at DESC
    LIMIT 100
  `;

  // 5. Resolve habit titles for share events
  const allShareHabitIds = shareEvents.flatMap((se: any) => se.habitids || []);
  let shareHabitTitles: Record<string, string> = {};
  if (allShareHabitIds.length > 0) {
    const habitRows = await sql`
      SELECT id, title FROM habits WHERE id = ANY(${allShareHabitIds}::uuid[])
    `;
    shareHabitTitles = Object.fromEntries(habitRows.map((r: any) => [String(r.id), r.title]));
  }

  // 6. The "Narrator" Logic — Categories 1 & 2 (habit logs)
  const feedFromLogs = logs.map((log: any) => {
    let type = '';
    let message = '';

    const dateFormatted = format(parseISO(log.date), 'MMM d');

    const formatStreak = (days: number) => {
      if (days < 365) return `[S:${days}]${days}-day streak[/S]`;
      const years = Math.floor(days / 365);
      const rem = days % 365;
      const yt = years === 1 ? '1-year' : `${years}-year`;
      if (rem === 0) return `[S:${days}]${yt} streak (${days} days)[/S]`;
      return `[S:${days}]${yt} and ${rem}-day streak (${days} days)[/S]`;
    };
    const formatExtensionDuration = (days: number) => {
      if (days < 365) return `[S:${days}]${days} days[/S]`;
      const years = Math.floor(days / 365);
      const rem = days % 365;
      const yt = years === 1 ? '1-year' : `${years}-year`;
      if (rem === 0) return `[S:${days}]${yt} (${days} days)[/S]`;
      const dt = rem === 1 ? '1 day' : `${rem} days`;
      return `[S:${days}]${yt} and ${dt} (${days} days)[/S]`;
    };
    const pronoun = log.ownerid === userId ? 'your' : 'their';
    const isVeteran = (log.streakCount || 0) >= 365;
    const milestones = [5, 7, 14, 21, 30, 60, 90, 100, 180, 300];

    // Rule 1.1: Initial Completion (Day 1)
    if (log.status === 'completed' && log.streakCount === 1) {
      type = 'INITIAL_COMPLETION';
      message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    }
    // Rule 1.2: Initial Skip
    else if (log.status === 'skipped' && log.streakCount <= 1) {
      type = 'INITIAL_SKIP';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    }
    // Rule 1.3: Initial Failure
    else if (log.status === 'failed' && log.streakCount === 0 && (log.brokenStreakCount || 0) <= 1) {
      type = 'INITIAL_FAILURE';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    }

    // --- CATEGORY 2: STREAK DYNAMICS ---
    else if (log.status === 'completed' && log.streakCount > 1) {
      const isAnnual = log.streakCount % 365 === 0;
      const rem = log.streakCount % 365;

      // Trigger 2.1: Started a Streak (Day 2)
      if (log.streakCount === 2 && !isVeteran) {
        type = 'STREAK_STARTED';
        message = `started a streak by completing [H]${log.habitTitle}[/H] for ${dateFormatted}. That's [S:2]2[/S] in row!`;
      }
      // Trigger 2.2: Day 3 & Day 4 Completion
      else if ((log.streakCount === 3 || log.streakCount === 4) && !isVeteran) {
        type = 'STREAK_CONTINUED';
        message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
      }
      // Trigger 2.5: Annual Anniversary
      else if (isAnnual) {
        type = 'ANNUAL_ANNIVERSARY';
        message = `hit a ${formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      }
      // Trigger 2.4: Streak Milestone Reached
      else if (log.streakCount < 365 && milestones.includes(log.streakCount)) {
        if (!(isVeteran && log.streakCount === 5)) {
          type = 'STREAK_MILESTONE';
          message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
        }
      }
      // Trigger 2.6: Post-Year Milestone Reached
      else if (log.streakCount > 365 && rem >= 7 && milestones.includes(rem)) {
        type = 'POST_YEAR_MILESTONE';
        message = `hit a ${formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      }
      // Extension logic
      else if (log.streakCount > 4 || (isVeteran && log.streakCount >= 2)) {
        if (log.streakCount > 365) {
          // Trigger 2.8: Post-Year Standard Streak Extension
          type = 'POST_YEAR_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to ${formatExtensionDuration(log.streakCount)}!`;
        } else {
          // Trigger 2.7: Standard Streak Extension
          type = 'STREAK_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to [S:${log.streakCount}]${log.streakCount} days[/S]!`;
        }
      }
    }
    // Trigger 2.3: Streak Broken (Fail/Miss)
    else if (log.status === 'failed' && (log.brokenStreakCount || 0) > 1) {
      type = 'STREAK_BROKEN';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}, bringing ${pronoun} ${formatStreak(log.brokenStreakCount as number)} to an end.`;
    }
    // Trigger 2.9: Streak Maintained (Skip)
    else if (log.status === 'skipped' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}; ${pronoun} ${formatStreak(log.streakCount)} remains intact.`;
    }

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

  // 7. Narrator Logic — Category 3: Commitments (Trigger 3.1)
  const feedFromCommitments = commitments.map((c: any) => {
    const dateFormatted = format(parseISO(c.date), 'MMM d');
    return {
      id: `commitment-${c.id}`,
      type: 'COMMITMENT',
      user: {
        id: c.ownerid,
        name: c.ownerid === userId ? 'You' : c.username,
        photoUrl: c.photourl
      },
      habit: {
        id: c.id,
        title: c.habitTitle
      },
      message: `committed to a new habit: [H]${c.habitTitle}[/H] on ${dateFormatted}.`,
      date: c.date,
      timestamp: c.updatedat
    };
  });

  // 8. Narrator Logic — Category 3: Share Events (Trigger 3.2)
  // Group share events by (ownerid, user_date, habitids, timestamp) for the owner
  const groupedShares: any[] = [];
  const shareGroups = new Map<string, any[]>();

  for (const se of shareEvents) {
    const isOwner = se.ownerid === userId;
    if (isOwner) {
      const habitKey = (se.habitids || []).map(String).sort().join(',');
      const ts = new Date(se.updatedat).getTime();
      const groupKey = `${se.ownerid}-${se.date}-${habitKey}-${ts}`;
      
      if (!shareGroups.has(groupKey)) {
        shareGroups.set(groupKey, []);
      }
      shareGroups.get(groupKey)!.push(se);
    } else {
      groupedShares.push(se);
    }
  }

  // Process groups
  for (const group of shareGroups.values()) {
    if (group.length === 1) {
      groupedShares.push(group[0]);
    } else {
      const first = group[0];
      groupedShares.push({
        ...first,
        recipientCount: group.length,
        isGroupedAction: true
      });
    }
  }

  const feedFromShares = groupedShares.map((se: any) => {
    const dateFormatted = format(parseISO(se.date), 'MMM d');
    const habitIds = (se.habitids || []).map(String);
    const habits = habitIds.map((hid: string) => ({
      id: hid,
      title: shareHabitTitles[hid] || 'Unknown Habit'
    }));

    const isOwner = se.ownerid === userId;
    const recipientLabel = se.recipientid === userId ? 'you' : se.recipient_username;
    const recipientFormatted = `[U]${recipientLabel}[/U]`;

    let message: string;
    const habitText = habits.length === 1 ? `[H]${habits[0].title}[/H]` : `${habits.length} habits`;

    if (se.isGroupedAction) {
      message = `shared ${habitText} with ${se.recipientCount} friends on ${dateFormatted}.`;
    } else if (habits.length === 1) {
      message = `shared ${habitText} with ${recipientFormatted} on ${dateFormatted}.`;
    } else {
      message = `shared ${habitText} with ${recipientFormatted} on ${dateFormatted}.`;
    }

    return {
      id: `share-${se.id}`,
      type: 'SHARE',
      user: {
        id: se.ownerid,
        name: isOwner ? 'You' : se.username,
        photoUrl: se.photourl
      },
      habit: habits.length === 1 ? habits[0] : { id: null, title: habits.map((h: any) => h.title).join(', ') },
      habits,
      message,
      date: se.date,
      timestamp: se.updatedat
    };
  });

  // 9. Merge all sources & sort by date DESC, timestamp DESC, id DESC
  const allFeed = [...feedFromLogs, ...feedFromCommitments, ...feedFromShares];
  allFeed.sort((a: any, b: any) => {
    // Primary: date descending
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    // Secondary: timestamp descending
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    // Tertiary: id descending (string compare)
    return String(b.id).localeCompare(String(a.id));
  });

  return allFeed.slice(0, 100);
});
