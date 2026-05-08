import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import { friendships as friendshipsTable, habitLogs, habits as habitsTable, users, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { format, parseISO } from 'date-fns';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  // 1. Get friend IDs (only accepted friendships)
  const friendshipRes = await db.select({
    initiatorId: friendshipsTable.initiatorId,
    receiverId: friendshipsTable.receiverId
  })
  .from(friendshipsTable)
  .where(and(
    or(eq(friendshipsTable.initiatorId, userId), eq(friendshipsTable.receiverId, userId)),
    eq(friendshipsTable.status, 'accepted')
  ));

  const friendIds = friendshipRes.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
  const hasFriends = friendIds.length > 0;

  // 2. Query habit logs (Categories 1 & 2)
  const logsQuery = db.select({
    id: habitLogs.id,
    habitId: habitLogs.habitId,
    ownerId: habitLogs.ownerId,
    date: habitLogs.date,
    status: habitLogs.status,
    streakCount: habitLogs.streakCount,
    brokenStreakCount: habitLogs.brokenStreakCount,
    sharedWith: habitLogs.sharedWith,
    updatedAt: habitLogs.updatedAt,
    habitTitle: habitsTable.title,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(habitLogs)
  .innerJoin(habitsTable, eq(habitLogs.habitId, habitsTable.id))
  .innerJoin(users, sql`${habitLogs.ownerId}::uuid = ${users.id}`);

  if (hasFriends) {
    logsQuery.where(or(
      and(inArray(habitLogs.ownerId, friendIds), sql`${habitsTable.sharedWith} @> ARRAY[${userId}]::text[]`),
      eq(habitLogs.ownerId, userId)
    ));
  } else {
    logsQuery.where(eq(habitLogs.ownerId, userId));
  }

  const logsRaw = await logsQuery.orderBy(desc(habitLogs.date), desc(habitLogs.updatedAt), desc(habitLogs.id)).limit(100);

  // 3. Query habit commitments (Category 3 - Trigger 3.1)
  const commitmentsQuery = db.select({
    id: habitsTable.id,
    ownerId: habitsTable.ownerId,
    date: habitsTable.userDate,
    updatedAt: habitsTable.createdAt,
    habitTitle: habitsTable.title,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(habitsTable)
  .innerJoin(users, sql`${habitsTable.ownerId}::uuid = ${users.id}`)
  .where(sql`${habitsTable.userDate} IS NOT NULL`);

  if (hasFriends) {
    commitmentsQuery.where(and(
      sql`${habitsTable.userDate} IS NOT NULL`,
      or(
        eq(habitsTable.ownerId, userId),
        and(inArray(habitsTable.ownerId, friendIds), sql`${habitsTable.sharedWith} @> ARRAY[${userId}]::text[]`)
      )
    ));
  } else {
    commitmentsQuery.where(and(
      sql`${habitsTable.userDate} IS NOT NULL`,
      eq(habitsTable.ownerId, userId)
    ));
  }

  const commitmentsRaw = await commitmentsQuery.orderBy(desc(habitsTable.userDate), desc(habitsTable.createdAt)).limit(100);

  // 4. Query share events (Category 3 - Trigger 3.2)
  const shareEventsQuery = db.select({
    id: shareEvents.id,
    ownerId: shareEvents.ownerId,
    recipientId: shareEvents.recipientId,
    habitIds: shareEvents.habitIds,
    date: shareEvents.userDate,
    updatedAt: shareEvents.createdAt,
    username: users.username,
    photoUrl: users.photoUrl,
    recipientUsername: sql<string>`ru.username`
  })
  .from(shareEvents)
  .innerJoin(users, eq(shareEvents.ownerId, users.id))
  .innerJoin(sql`users ru`, eq(shareEvents.recipientId, sql`ru.id`));

  if (hasFriends) {
    shareEventsQuery.where(or(
      and(inArray(shareEvents.ownerId, friendIds), eq(shareEvents.recipientId, userId)),
      eq(shareEvents.ownerId, userId)
    ));
  } else {
    shareEventsQuery.where(eq(shareEvents.ownerId, userId));
  }

  const shareEventsRaw = await shareEventsQuery.orderBy(desc(shareEvents.userDate), desc(shareEvents.createdAt)).limit(100);

  // 5. Resolve habit titles for share events
  const allShareHabitIds = [...new Set(shareEventsRaw.flatMap((se: any) => se.habitIds || []))];
  let shareHabitTitles: Record<string, string> = {};
  if (allShareHabitIds.length > 0) {
    const habitRows = await db.select({ id: habitsTable.id, title: habitsTable.title })
      .from(habitsTable)
      .where(inArray(habitsTable.id, allShareHabitIds as any));
    shareHabitTitles = Object.fromEntries(habitRows.map((r: any) => [String(r.id), r.title]));
  }

  // 6. The "Narrator" Logic — Categories 1 & 2 (habit logs)
  const formatStreak = (days: number, isBroken: boolean = false) => {
    const suffix = isBroken ? ':broken' : '';
    if (days < 365) return `[S:${days}${suffix}]${days}-day streak[/S]`;
    const years = Math.floor(days / 365);
    const rem = days % 365;
    const yt = years === 1 ? '1-year' : `${years}-year`;
    if (rem === 0) return `[S:${days}${suffix}]${yt} streak (${days} days)[/S]`;
    return `[S:${days}${suffix}]${yt} and ${rem}-day streak (${days} days)[/S]`;
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

  const feedFromLogs = logsRaw.map((log: any) => {
    let type = '';
    let message = '';
    const dateFormatted = format(parseISO(log.date), 'MMM d');
    const pronoun = log.ownerId === userId ? 'your' : 'their';
    const isVeteran = (log.streakCount || 0) >= 365;
    const milestones = [5, 7, 14, 21, 30, 60, 90, 100, 180, 300];

    if (log.status === 'completed' && log.streakCount === 1) {
      type = 'INITIAL_COMPLETION';
      message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'skipped' && log.streakCount <= 1) {
      type = 'INITIAL_SKIP';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'failed' && log.streakCount === 0 && (log.brokenStreakCount || 0) <= 1) {
      type = 'INITIAL_FAILURE';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
    } else if (log.status === 'vacation' && log.streakCount <= 1) {
      type = 'INITIAL_VACATION';
      message = `took a vacation day for [H]${log.habitTitle}[/H] on ${dateFormatted}.`;
    } else if (log.status === 'completed' && log.streakCount > 1) {
      const isAnnual = log.streakCount % 365 === 0;
      const rem = log.streakCount % 365;
      if (log.streakCount === 2 && !isVeteran) {
        type = 'STREAK_STARTED';
        message = `started a streak by completing [H]${log.habitTitle}[/H] for ${dateFormatted}. That's [S:2]2[/S] in row!`;
      } else if ((log.streakCount === 3 || log.streakCount === 4) && !isVeteran) {
        type = 'STREAK_CONTINUED';
        message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}.`;
      } else if (isAnnual) {
        type = 'ANNUAL_ANNIVERSARY';
        message = `hit a ${formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      } else if (log.streakCount < 365 && milestones.includes(log.streakCount)) {
        if (!(isVeteran && log.streakCount === 5)) {
          type = 'STREAK_MILESTONE';
          message = `hit a [S:${log.streakCount}]${log.streakCount}-day streak[/S] by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
        }
      } else if (log.streakCount > 365 && rem >= 7 && milestones.includes(rem)) {
        type = 'POST_YEAR_MILESTONE';
        message = `hit a ${formatStreak(log.streakCount)} by completing [H]${log.habitTitle}[/H] for ${dateFormatted}!`;
      } else if (log.streakCount > 4 || (isVeteran && log.streakCount >= 2)) {
        if (log.streakCount > 365) {
          type = 'POST_YEAR_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to ${formatExtensionDuration(log.streakCount)}!`;
        } else {
          type = 'STREAK_EXTENSION';
          message = `completed [H]${log.habitTitle}[/H] for ${dateFormatted}—extending ${pronoun} streak to [S:${log.streakCount}]${log.streakCount} days[/S]!`;
        }
      }
    } else if (log.status === 'failed' && (log.brokenStreakCount || 0) > 1) {
      type = 'STREAK_BROKEN';
      message = `failed [H]${log.habitTitle}[/H] for ${dateFormatted}, bringing ${pronoun} ${formatStreak(log.brokenStreakCount as number, true)} to an end.`;
    } else if (log.status === 'skipped' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED';
      message = `skipped [H]${log.habitTitle}[/H] for ${dateFormatted}; ${pronoun} ${formatStreak(log.streakCount)} remains intact.`;
    } else if (log.status === 'vacation' && log.streakCount > 1) {
      type = 'STREAK_MAINTAINED_VACATION';
      message = `took a vacation day for [H]${log.habitTitle}[/H] on ${dateFormatted}; ${pronoun} ${formatStreak(log.streakCount)} remains intact.`;
    }

    if (type) {
      return {
        id: log.id,
        type,
        user: {
          id: log.ownerId,
          name: log.ownerId === userId ? 'You' : log.username,
          photoUrl: log.photoUrl
        },
        habit: {
          id: log.habitId,
          title: log.habitTitle
        },
        message,
        date: log.date,
        timestamp: log.updatedAt
      };
    }
    return null;
  }).filter(Boolean);

  // 7. Narrator Logic — Category 3: Commitments (Trigger 3.1)
  const feedFromCommitments = commitmentsRaw.map((c: any) => {
    const dateFormatted = format(parseISO(c.date), 'MMM d');
    return {
      id: `commitment-${c.id}`,
      type: 'COMMITMENT',
      user: {
        id: c.ownerId,
        name: c.ownerId === userId ? 'You' : c.username,
        photoUrl: c.photoUrl
      },
      habit: {
        id: c.id,
        title: c.habitTitle
      },
      message: `committed to a new habit: [H]${c.habitTitle}[/H] on ${dateFormatted}.`,
      date: c.date,
      timestamp: c.updatedAt
    };
  });

  // 8. Narrator Logic — Category 3: Share Events (Trigger 3.2)
  const groupedShares: any[] = [];
  const shareGroups = new Map<string, any[]>();

  for (const se of shareEventsRaw) {
    const isOwner = se.ownerId === userId;
    if (isOwner) {
      const habitKey = (se.habitIds || []).map(String).sort().join(',');
      const ts = new Date(se.updatedAt).getTime();
      const groupKey = `${se.ownerId}-${se.date}-${habitKey}-${ts}`;
      if (!shareGroups.has(groupKey)) shareGroups.set(groupKey, []);
      shareGroups.get(groupKey)!.push(se);
    } else {
      groupedShares.push(se);
    }
  }

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
    const habitIds = (se.habitIds || []).map(String);
    const habits = habitIds.map((hid: string) => ({
      id: hid,
      title: shareHabitTitles[hid] || 'Unknown Habit'
    }));

    const isOwner = se.ownerId === userId;
    const recipientLabel = se.recipientId === userId ? 'you' : se.recipientUsername;
    const recipientFormatted = `[U:${se.recipientId}]${recipientLabel}[/U]`;

    let message: string;
    const habitText = habits.length === 1 ? `[H]${habits[0].title}[/H]` : `${habits.length} habits`;

    if (se.isGroupedAction) {
      message = `shared ${habitText} with ${se.recipientCount} friends on ${dateFormatted}.`;
    } else {
      message = `shared ${habitText} with ${recipientFormatted} on ${dateFormatted}.`;
    }

    return {
      id: `share-${se.id}`,
      type: 'SHARE',
      user: {
        id: se.ownerId,
        name: isOwner ? 'You' : se.username,
        photoUrl: se.photoUrl
      },
      habit: habits.length === 1 ? habits[0] : { id: null, title: habits.map((h: any) => h.title).join(', ') },
      habits,
      message,
      date: se.date,
      timestamp: se.updatedAt
    };
  });

  // 9. Merge and sort
  const allFeed = [...feedFromLogs, ...feedFromCommitments, ...feedFromShares];
  allFeed.sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    return String(b.id).localeCompare(String(a.id));
  });

  return { data: allFeed.slice(0, 100) };
});
