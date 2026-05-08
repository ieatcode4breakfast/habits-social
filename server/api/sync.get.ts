import { eq, and, or, sql, inArray, gte, lte, asc, desc, notExists } from 'drizzle-orm';
import { habits as habitsTable, buckets as bucketsTable, habitLogs, bucketLogs, syncDeletions, sharedBucketMembers, bucketHabits, users } from '~~/server/db/schema';
import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { normalizeHabit, normalizeBucket, normalizeLog } from '~~/server/utils/normalize';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);
  const query = getQuery(event);
  
  // Use a numeric timestamp in ms (epoch)
  const lastSynced = query.lastSynced ? Number(query.lastSynced) : 0;

  // 1. Get the current authoritative server time from the database
  const timeRes = await db.execute(sql`SELECT EXTRACT(EPOCH FROM NOW()) * 1000 as now`);
  const firstRow = (timeRes as any[])?.[0];
  if (!firstRow) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get server time' });
  }
  const serverTime = Math.floor(Number(firstRow.now));

  // 2. Fetch all deltas in parallel
  const [habitsRes, personalBucketsRes, sharedBucketsRes, habitLogsRes, bucketLogsRes, deletionsRes] = await Promise.all([
    // Habits
    db.select().from(habitsTable).where(and(
      eq(habitsTable.ownerId, userId),
      lastSynced > 0 ? gte(habitsTable.updatedAt, new Date(lastSynced)) : undefined
    )).orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt)),
    
    // Personal Buckets
    db.select().from(bucketsTable).where(and(
      eq(bucketsTable.ownerId, userId),
      notExists(db.select().from(sharedBucketMembers).where(eq(sharedBucketMembers.bucketId, bucketsTable.id))),
      lastSynced > 0 ? gte(bucketsTable.updatedAt, new Date(lastSynced)) : undefined
    )).orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),
    
    // Shared Buckets
    db.select({ b: bucketsTable }).from(bucketsTable)
      .innerJoin(sharedBucketMembers, eq(bucketsTable.id, sharedBucketMembers.bucketId))
      .where(and(
        eq(sharedBucketMembers.userId, userId),
        eq(sharedBucketMembers.status, 'accepted'),
        lastSynced > 0 ? gte(bucketsTable.updatedAt, new Date(lastSynced)) : undefined
      )).orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),
    
    // Habit Logs
    db.select().from(habitLogs).where(and(
      eq(habitLogs.ownerId, userId),
      lastSynced > 0 
        ? gte(habitLogs.updatedAt, new Date(lastSynced))
        : (query.startDate && query.endDate 
            ? and(gte(habitLogs.date, String(query.startDate)), lte(habitLogs.date, String(query.endDate)))
            : undefined)
    )),
    
    // Bucket Logs
    db.select().from(bucketLogs).where(and(
      eq(bucketLogs.ownerId, userId),
      lastSynced > 0 
        ? gte(bucketLogs.updatedAt, new Date(lastSynced))
        : (query.startDate && query.endDate 
            ? and(gte(bucketLogs.date, String(query.startDate)), lte(bucketLogs.date, String(query.endDate)))
            : undefined)
    )),
    
    // Deletions
    db.select({ entityId: syncDeletions.entityId, entityType: syncDeletions.entityType })
      .from(syncDeletions)
      .where(and(
        eq(syncDeletions.ownerId, userId),
        lastSynced > 0 ? gte(syncDeletions.createdAt, new Date(lastSynced)) : undefined
      ))
  ]);

  const buckets = [
    ...personalBucketsRes,
    ...sharedBucketsRes.map(r => r.b)
  ];

  // 3. For buckets, we need their habit mappings and shared metadata too if they changed
  let bucketHabitsResult: any[] = [];
  let sharedMembersResult: any[] = [];
  if (buckets.length > 0) {
    const bucketIds = buckets.map((b: any) => b.id);
    bucketHabitsResult = await db.select({
      bh: bucketHabits,
      habitOwnerId: habitsTable.ownerId
    })
    .from(bucketHabits)
    .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
    .where(and(
      inArray(bucketHabits.bucketId, bucketIds),
      or(
        sql`${bucketHabits.approvalStatus} IS NULL`,
        inArray(bucketHabits.approvalStatus, ['accepted', 'pending'])
      )
    ));

    sharedMembersResult = await db.select({
      sbm: sharedBucketMembers,
      username: users.username
    })
    .from(sharedBucketMembers)
    .innerJoin(users, eq(sharedBucketMembers.userId, users.id))
    .where(inArray(sharedBucketMembers.bucketId, bucketIds));
  }

  // 4. Normalize and combine
  const normalizedBuckets = buckets.map((b: any) => {
    const habitsForBucket = bucketHabitsResult.filter((r: any) => r.bh.bucketId === b.id);
    const membersForBucket = sharedMembersResult.filter((r: any) => r.sbm.bucketId === b.id);
    
    return normalizeBucket({ 
      ...b, 
      habitIds: habitsForBucket.map((r: any) => r.bh.habitId),
      sharedMembers: membersForBucket.map((r: any) => ({
        userId: r.sbm.userId,
        username: r.username,
        status: r.sbm.status
      })),
      sharedHabits: habitsForBucket.map((r: any) => ({
        habitId: r.bh.habitId,
        approvalStatus: r.bh.approvalStatus,
        addedBy: r.bh.addedBy,
        habitOwnerId: r.habitOwnerId
      }))
    });
  });

  return {
    habits: habitsRes.map(normalizeHabit),
    buckets: normalizedBuckets,
    habitLogs: habitLogsRes.map(normalizeLog),
    bucketLogs: bucketLogsRes.map(normalizeLog),
    deletions: deletionsRes.map((d: any) => ({ id: d.entityId, type: d.entityType })),
    serverTime
  };
});
