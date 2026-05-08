import { eq, and, or, sql, inArray, gte, lte, asc, desc, notExists } from 'drizzle-orm';
import { habits as habitsTable, buckets as bucketsTable, habitLogs, bucketLogs, syncDeletions, sharedBucketMembers, bucketHabits, users } from '~~/server/db/schema';
import { useDB, getServerTime } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { normalizeHabit, normalizeBucket, normalizeLog } from '~~/server/utils/normalize';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);
  const query = getQuery(event);
  
  // Use a numeric timestamp in ms (epoch)
  const lastSynced = query.lastSynced ? Number(query.lastSynced) : 0;

  // 1. Get the current authoritative server time from the database
  const serverTime = await getServerTime(db);

  // 2. Construct filters explicitly to avoid relying on undefined in and()
  const habitsFilters = [eq(habitsTable.ownerId, userId)];
  const personalBucketsFilters = [
    eq(bucketsTable.ownerId, userId),
    notExists(db.select().from(sharedBucketMembers).where(eq(sharedBucketMembers.bucketId, bucketsTable.id)))
  ];
  const sharedBucketsFilters = [
    eq(sharedBucketMembers.userId, userId),
    eq(sharedBucketMembers.status, 'accepted')
  ];
  const habitLogsFilters = [eq(habitLogs.ownerId, userId)];
  const bucketLogsFilters = [eq(bucketLogs.ownerId, userId)];
  const deletionsFilters = [eq(syncDeletions.ownerId, userId)];

  if (lastSynced > 0) {
    const syncDate = new Date(lastSynced);
    habitsFilters.push(gte(habitsTable.updatedAt, syncDate));
    personalBucketsFilters.push(gte(bucketsTable.updatedAt, syncDate));
    sharedBucketsFilters.push(gte(bucketsTable.updatedAt, syncDate));
    habitLogsFilters.push(gte(habitLogs.updatedAt, syncDate));
    bucketLogsFilters.push(gte(bucketLogs.updatedAt, syncDate));
    deletionsFilters.push(gte(syncDeletions.createdAt, syncDate));
  } else if (query.startDate && query.endDate) {
    const startDate = String(query.startDate);
    const endDate = String(query.endDate);
    habitLogsFilters.push(and(gte(habitLogs.date, startDate), lte(habitLogs.date, endDate)));
    bucketLogsFilters.push(and(gte(bucketLogs.date, startDate), lte(bucketLogs.date, endDate)));
  }

  // 3. Fetch all deltas in parallel
  const [habitsRes, personalBucketsRes, sharedBucketsRes, habitLogsRes, bucketLogsRes, deletionsRes] = await Promise.all([
    // Habits
    db.select().from(habitsTable)
      .where(and(...habitsFilters))
      .orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt)),
    
    // Personal Buckets
    db.select().from(bucketsTable)
      .where(and(...personalBucketsFilters))
      .orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),
    
    // Shared Buckets
    db.select({ b: bucketsTable }).from(bucketsTable)
      .innerJoin(sharedBucketMembers, eq(bucketsTable.id, sharedBucketMembers.bucketId))
      .where(and(...sharedBucketsFilters))
      .orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),
    
    // Habit Logs
    db.select().from(habitLogs)
      .where(and(...habitLogsFilters)),
    
    // Bucket Logs
    db.select().from(bucketLogs)
      .where(and(...bucketLogsFilters)),
    
    // Deletions
    db.select({ entityId: syncDeletions.entityId, entityType: syncDeletions.entityType })
      .from(syncDeletions)
      .where(and(...deletionsFilters))
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
