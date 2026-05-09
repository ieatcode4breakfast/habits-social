import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import { friendships as friendshipsTable, habitLogs, habits as habitsTable, users, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { format, parseISO } from 'date-fns';
import { SocialNarratorService } from '~~/server/services/social-narrator.service';

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
  const feedFromLogs = logsRaw.map((log: any) => SocialNarratorService.narrateLog(log, userId)).filter(Boolean);

  // 7. Narrator Logic — Category 3: Commitments (Trigger 3.1)
  const feedFromCommitments = commitmentsRaw.map((c: any) => SocialNarratorService.narrateCommitment(c, userId));

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

  const feedFromShares = groupedShares.map((se: any) => SocialNarratorService.narrateShare(se, userId, shareHabitTitles));

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
