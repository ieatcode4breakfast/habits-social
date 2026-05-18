import { eq, and, or, sql, inArray, desc, gte, lte } from 'drizzle-orm';
import { format, parseISO, subDays } from 'date-fns';
import { friendships as friendshipsTable, habitLogs, habits as habitsTable, users, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { SocialNarratorService, type HabitLogSummary } from '~~/server/services/social-narrator.service';

export interface FeedRowBase {
  id: string;
  owner_id: string;
  sort_date: string;
  sort_timestamp: string;
  username: string;
  photo_url: string;
}

export interface LogFeedRow extends FeedRowBase {
  source_type: 'log';
  raw_data: {
    id: string;
    habitId: string;
    ownerId: string;
    date: string;
    status: string;
    streakCount: number;
    brokenStreakCount: number;
    updatedAt: string;
    habitTitle: string;
  };
}

export interface HabitFeedRow extends FeedRowBase {
  source_type: 'habit';
  raw_data: {
    id: string;
    ownerId: string;
    date: string;
    updatedAt: string;
    habitTitle: string;
  };
}

export interface ShareFeedRow extends FeedRowBase {
  source_type: 'share';
  raw_data: {
    id: string;
    ownerId: string;
    recipientId: string;
    habitIds: string[];
    date: string;
    updatedAt: string;
  };
}

export type FeedEngineRow = LogFeedRow | HabitFeedRow | ShareFeedRow;

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  const query = getQuery(event);
  const cursorDate = query.cursorDate as string;
  const cursorTimestamp = query.cursorTimestamp as string;
  const cursorId = query.cursorId as string;
  const limit = Math.max(1, Math.min(Number(query.limit) || 20, 50));

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

  const friendIds = [userId, ...friendshipRes.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId)];

  // 2. Stage 1: The Final Engine
  // We use a LATERAL join to fetch records per friend and union them.
  // This allows the index to be used effectively for each friend in the list.
  const cursorLog = cursorDate && cursorTimestamp && cursorId 
    ? sql`AND (hl.date, hl.updated_at, hl.id::text) < (${cursorDate}, ${cursorTimestamp}::timestamptz, ${cursorId})`
    : sql``;

  const cursorHabit = cursorDate && cursorTimestamp && cursorId 
    ? sql`AND (h.user_date, h.created_at, h.id::text) < (${cursorDate}, ${cursorTimestamp}::timestamptz, ${cursorId})`
    : sql``;

  const cursorShare = cursorDate && cursorTimestamp && cursorId 
    ? sql`AND (se.user_date, se.created_at, se.id::text) < (${cursorDate}, ${cursorTimestamp}::timestamptz, ${cursorId})`
    : sql``;

  const todayString = format(new Date(), 'yyyy-MM-dd');

  const engineQuery = sql`
    WITH friend_list AS (
      SELECT unnest(ARRAY[${sql.join(friendIds.map(id => sql`${id}::uuid`), sql`, `)}]) as friend_id
    )
    SELECT feed.*, u.username, u.photo_url
    FROM friend_list f
    CROSS JOIN LATERAL (
      -- Branch 1: Habit Logs
      SELECT 
        hl.id::text as id,
        hl.owner_id::text as owner_id,
        hl.date as sort_date,
        hl.updated_at as sort_timestamp,
        'log' as source_type,
        json_build_object(
          'id', hl.id,
          'habitId', hl.habit_id,
          'ownerId', hl.owner_id,
          'date', hl.date,
          'status', hl.status,
          'streakCount', hl.streak_count,
          'brokenStreakCount', hl.broken_streak_count,
          'updatedAt', hl.updated_at,
          'habitTitle', h.title
        ) as raw_data
      FROM ${habitLogs} hl
      JOIN ${habitsTable} h ON hl.habit_id = h.id
      WHERE hl.owner_id = f.friend_id
        AND (${userId}::text = ANY(h.shared_with) OR hl.owner_id = ${userId}::uuid)
        ${cursorLog}
        AND (
          hl.date >= ${todayString}
          OR hl.broken_streak_count > 1
          OR (
            hl.streak_count > 1 AND (
              hl.streak_count IN (2, 3, 4, 5, 7, 14, 21, 30, 60, 90, 100, 180, 300)
              OR hl.streak_count % 365 = 0
              OR (hl.streak_count > 365 AND MOD(hl.streak_count, 365) IN (5, 7, 14, 21, 30, 60, 90, 100, 180, 300))
            )
          )
        )
      
      UNION ALL

      -- Branch 2: Habits (Commitments)
      SELECT 
        h.id::text as id,
        h.owner_id::text as owner_id,
        h.user_date as sort_date,
        h.created_at as sort_timestamp,
        'habit' as source_type,
        json_build_object(
          'id', h.id,
          'ownerId', h.owner_id,
          'date', h.user_date,
          'updatedAt', h.created_at,
          'habitTitle', h.title
        ) as raw_data
      FROM ${habitsTable} h
      WHERE h.owner_id = f.friend_id
        AND h.user_date IS NOT NULL
        AND (${userId}::text = ANY(h.shared_with) OR h.owner_id = ${userId}::uuid)
        ${cursorHabit}

      UNION ALL

      -- Branch 3: Share Events
      SELECT 
        se.id::text as id,
        se.owner_id::text as owner_id,
        se.user_date as sort_date,
        se.created_at as sort_timestamp,
        'share' as source_type,
        json_build_object(
          'id', se.id,
          'ownerId', se.owner_id,
          'recipientId', se.recipient_id,
          'habitIds', se.habit_ids,
          'date', se.user_date,
          'updatedAt', se.created_at
        ) as raw_data
      FROM ${shareEvents} se
      WHERE se.owner_id = f.friend_id
        AND (se.recipient_id = ${userId}::uuid OR se.owner_id = ${userId}::uuid)
        ${cursorShare}

      ORDER BY sort_date DESC, sort_timestamp DESC, id DESC
      LIMIT ${limit + 1}
    ) feed
    JOIN ${users} u ON feed.owner_id::uuid = u.id
    ORDER BY feed.sort_date DESC, feed.sort_timestamp DESC, feed.id DESC
    LIMIT ${limit + 1}
  `;

  let rawResults;
  try {
    rawResults = await db.execute(engineQuery);
  } catch (err: any) {
    console.error('[Feed Error] Failed to execute engine query:', err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    });
  }
  const rows = rawResults.rows as unknown as FeedEngineRow[];

  // 3. Stage 2: Protected Look-Ahead for Share Events
  // If we have share events, we need to resolve habit titles.
  const shareRows = rows.filter((r): r is ShareFeedRow => r.source_type === 'share');
  const allShareHabitIds = [...new Set(shareRows.flatMap(r => r.raw_data.habitIds || []))];
  let shareHabitTitles: Record<string, string> = {};
  
  if (allShareHabitIds.length > 0) {
    const habitRows = await db.select({ id: habitsTable.id, title: habitsTable.title })
      .from(habitsTable)
      .where(inArray(habitsTable.id, allShareHabitIds));
    shareHabitTitles = Object.fromEntries(habitRows.map((r: any) => [String(r.id), r.title]));
  }

  // Extra look-ahead for recipient usernames if needed (handled in narrative pass)
  // We'll also need recipient usernames for share events where current user is the owner
  const recipientIds = [...new Set(shareRows.map(r => r.raw_data.recipientId).filter(Boolean))];
  let recipientNames: Record<string, string> = {};
  if (recipientIds.length > 0) {
    const userRows = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, recipientIds));
    recipientNames = Object.fromEntries(userRows.map((r: any) => [String(r.id), r.username]));
  }

  // Look-Ahead for Weekly Logs
  const logRows = rows.filter((r): r is LogFeedRow => r.source_type === 'log');
  const logHabitIds = [...new Set(logRows.map(r => r.raw_data.habitId).filter(Boolean))];
  let habitLogsData: any[] = [];

  if (logHabitIds.length > 0) {
    const orConditions = logRows.map(r => {
      const itemDate = parseISO(r.sort_date);
      const startDate = format(subDays(itemDate, 7), 'yyyy-MM-dd');
      return and(
        eq(habitLogs.habitId, r.raw_data.habitId),
        gte(habitLogs.date, startDate),
        lte(habitLogs.date, r.sort_date)
      );
    });

    habitLogsData = await db.select({
      habitId: habitLogs.habitId,
      date: habitLogs.date,
      status: habitLogs.status
    })
    .from(habitLogs)
    .innerJoin(habitsTable, eq(habitLogs.habitId, habitsTable.id))
    .where(and(
      or(...orConditions),
      or(
        eq(habitsTable.ownerId, userId),
        sql`${userId}::text = ANY(${habitsTable.sharedWith})`
      )
    ));


  }

  // 4. Stage 3: Hybrid Narrative Pass
  const narratedFeed: any[] = [];
  const shareGroups = new Map<string, any[]>();

  for (const row of rows) {
    const data = row.raw_data;
    const itemWithUser = { ...data, username: row.username, photoUrl: row.photo_url };

    if (row.source_type === 'log') {
      const narrated = SocialNarratorService.narrateLog(itemWithUser, userId);
      if (narrated) narratedFeed.push(narrated);
    } else if (row.source_type === 'habit') {
      narratedFeed.push(SocialNarratorService.narrateCommitment(itemWithUser, userId));
    } else if (row.source_type === 'share') {
      const isOwner = row.owner_id === userId;
      if (isOwner) {
        const habitKey = (row.raw_data.habitIds || []).map(String).sort().join(',');
        const ts = new Date(data.updatedAt).getTime();
        const groupKey = `${row.owner_id}-${data.date}-${habitKey}-${ts}`;
        if (!shareGroups.has(groupKey)) shareGroups.set(groupKey, []);
        shareGroups.get(groupKey)!.push({ ...itemWithUser, recipientUsername: recipientNames[row.raw_data.recipientId] });
      } else {
        narratedFeed.push(SocialNarratorService.narrateShare({ ...itemWithUser, recipientUsername: recipientNames[row.raw_data.recipientId] }, userId, shareHabitTitles));
      }
    }
  }

  // Grouped Share Processing
  for (const group of shareGroups.values()) {
    if (group.length === 1) {
      narratedFeed.push(SocialNarratorService.narrateShare(group[0], userId, shareHabitTitles));
    } else {
      const first = group[0];
      narratedFeed.push(SocialNarratorService.narrateShare({
        ...first,
        recipientCount: group.length,
        isGroupedAction: true
      }, userId, shareHabitTitles));
    }
  }

  // Final sorting of narrated items (since grouping might have slightly shifted order)
  narratedFeed.sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    return String(b.id).localeCompare(String(a.id));
  });

  const hasNextPage = narratedFeed.length > limit;
  const slicedData = narratedFeed.slice(0, limit);
  const data = SocialNarratorService.enrichWithWeeklyLogs(slicedData, habitLogsData);
  
  let nextCursor = null;
  if (hasNextPage && data.length > 0) {
    const lastItem = data[data.length - 1];
    if (lastItem) {
      nextCursor = {
        date: lastItem.date,
        timestamp: lastItem.timestamp,
        id: lastItem.id
      };
    }
  }

  return { 
    data,
    nextCursor
  };
});
