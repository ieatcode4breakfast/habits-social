import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import { friendships as friendshipsTable, habitLogs, habits as habitsTable, users, shareEvents } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  // Get friend IDs (only accepted friendships)
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

  // Habit logs with friend visibility
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

  // Habits committed (new habits with userDate)
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

  // Share events
  const shareEventsQuery = db.select({
    id: shareEvents.id,
    ownerId: shareEvents.ownerId,
    recipientId: shareEvents.recipientId,
    habitIds: shareEvents.habitIds,
    date: shareEvents.userDate,
    updatedAt: shareEvents.createdAt,
    username: users.username,
    photoUrl: users.photoUrl,
    recipientUsername: sql`ru.username`
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

  // Merge and sort by date desc, timestamp desc
  const allItems = [
    ...logsRaw.map((l: any) => ({ type: 'log', date: l.date, timestamp: l.updatedAt, data: l })),
    ...commitmentsRaw.map((c: any) => ({ type: 'commitment', date: c.date, timestamp: c.updatedAt, data: c })),
    ...shareEventsRaw.map((s: any) => ({ type: 'share', date: s.date, timestamp: s.updatedAt, data: s }))
  ];

  allItems.sort((a: any, b: any) => {
    if (a.date !== b.date) return (a.date || '') > (b.date || '') ? -1 : 1;
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    return String(b.data.id).localeCompare(String(a.data.id));
  });

  return { data: allItems.slice(0, 100) };
});
