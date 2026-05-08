import { eq, and, or, sql, inArray, gte, lte, asc, desc, notExists } from 'drizzle-orm';
import { 
  habits as habitsTable, 
  buckets as bucketsTable, 
  habitLogs, 
  bucketLogs, 
  syncDeletions, 
  sharedBucketMembers, 
  bucketHabits, 
  users 
} from '~~/server/db/schema';
import { getServerTime } from '~~/server/utils/db';
import { normalizeHabit, normalizeBucket, normalizeLog } from '~~/server/utils/normalize';
import type { SyncParams, SyncResponse } from '~~/server/types/sync';

export const SyncService = {
  async getDeltas(db: any, userId: string, params: SyncParams): Promise<SyncResponse> {
    const { lastSynced = 0, startDate, endDate } = params;
    const serverTime = await getServerTime(db);

    const habitsFilters = [eq(habitsTable.ownerId, userId)];
    
    // Identifies buckets where user is owner OR an accepted member
    const bucketIdsSubquery = db.select({ id: bucketsTable.id })
      .from(bucketsTable)
      .leftJoin(sharedBucketMembers, eq(bucketsTable.id, sharedBucketMembers.bucketId))
      .where(or(
        eq(bucketsTable.ownerId, userId),
        and(
          eq(sharedBucketMembers.userId, userId),
          eq(sharedBucketMembers.status, 'accepted')
        )
      ));

    const bucketFilters = [inArray(bucketsTable.id, bucketIdsSubquery)];
    const habitLogsFilters = [eq(habitLogs.ownerId, userId)];
    const bucketLogsFilters = [eq(bucketLogs.ownerId, userId)];
    const deletionsFilters = [eq(syncDeletions.ownerId, userId)];

    if (lastSynced > 0) {
      const syncDate = new Date(lastSynced);
      habitsFilters.push(gte(habitsTable.updatedAt, syncDate));
      bucketFilters.push(gte(bucketsTable.updatedAt, syncDate));
      habitLogsFilters.push(gte(habitLogs.updatedAt, syncDate));
      bucketLogsFilters.push(gte(bucketLogs.updatedAt, syncDate));
      deletionsFilters.push(gte(syncDeletions.createdAt, syncDate));
    } else if (startDate && endDate) {
      habitLogsFilters.push(and(gte(habitLogs.date, startDate), lte(habitLogs.date, endDate)));
      bucketLogsFilters.push(and(gte(bucketLogs.date, startDate), lte(bucketLogs.date, endDate)));
    }

    // 1. Fetch main deltas in parallel
    // Note: To optimize bucket metadata, we join them here
    const [habitsRes, bucketsRawRes, habitLogsRes, bucketLogsRes, deletionsRes] = await Promise.all([
      db.select().from(habitsTable)
        .where(and(...habitsFilters))
        .orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt)),

      db.select({
        bucket: bucketsTable,
        bh: bucketHabits,
        habitOwnerId: habitsTable.ownerId,
        sbm: sharedBucketMembers,
        memberUsername: users.username
      })
      .from(bucketsTable)
      .leftJoin(bucketHabits, eq(bucketsTable.id, bucketHabits.bucketId))
      .leftJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
      .leftJoin(sharedBucketMembers, eq(bucketsTable.id, sharedBucketMembers.bucketId))
      .leftJoin(users, eq(sharedBucketMembers.userId, users.id))
      .where(and(...bucketFilters))
      .orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),

      db.select().from(habitLogs)
        .where(and(...habitLogsFilters)),

      db.select().from(bucketLogs)
        .where(and(...bucketLogsFilters)),

      db.select({ entityId: syncDeletions.entityId, entityType: syncDeletions.entityType })
        .from(syncDeletions)
        .where(and(...deletionsFilters))
    ]);

    // 2. Aggregate bucket results (handle Cartesian product from left joins)
    const bucketMap = new Map<string, any>();
    for (const row of bucketsRawRes) {
      const b = row.bucket;
      if (!bucketMap.has(b.id)) {
        bucketMap.set(b.id, {
          ...b,
          habitIds: new Set<string>(),
          sharedMembers: new Map<string, any>(),
          sharedHabits: new Map<string, any>()
        });
      }

      const entry = bucketMap.get(b.id);
      
      if (row.bh) {
        entry.habitIds.add(row.bh.habitId);
        if (!entry.sharedHabits.has(row.bh.habitId)) {
          entry.sharedHabits.set(row.bh.habitId, {
            habitId: row.bh.habitId,
            approvalStatus: row.bh.approvalStatus,
            addedBy: row.bh.addedBy,
            habitOwnerId: row.habitOwnerId
          });
        }
      }

      if (row.sbm) {
        if (!entry.sharedMembers.has(row.sbm.userId)) {
          entry.sharedMembers.set(row.sbm.userId, {
            userId: row.sbm.userId,
            username: row.memberUsername,
            status: row.sbm.status
          });
        }
      }
    }

    const normalizedBuckets = Array.from(bucketMap.values()).map(b => {
      return normalizeBucket({
        ...b,
        habitIds: Array.from(b.habitIds),
        sharedMembers: Array.from(b.sharedMembers.values()),
        sharedHabits: Array.from(b.sharedHabits.values())
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
  }
};
