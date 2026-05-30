import { eq, and, or, sql, inArray, gte, lte, asc, desc, gt, isNull, ne } from 'drizzle-orm';
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
import type { HabitStreakBaseline, SyncParams, SyncResponse } from '~~/server/types/sync';
import type { DBConnection } from '../types/db';

const V1_SAFETY_THRESHOLD = 5000;

interface HabitIdRow {
  id: string;
}

interface HabitBaselineRow {
  habitId: string;
  baselineCurrentStreak: number | null;
  baselineLongestStreak: number | null;
  baselineStreakAnchorDate: string | null;
}

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toOptionalString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const addDaysToDateString = (date: string, days: number): string => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const SyncService = {
  /**
   * Legacy V1 check to prevent memory exhaustion
   */
  async checkV1PayloadSize(db: DBConnection, userId: string): Promise<boolean> {
    const counts = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM habits WHERE owner_id = ${userId}) +
        (SELECT COUNT(*) FROM buckets WHERE owner_id = ${userId}) +
        (SELECT COUNT(*) FROM habit_logs WHERE owner_id = ${userId}) +
        (SELECT COUNT(*) FROM bucket_logs WHERE owner_id = ${userId}) +
        (SELECT COUNT(*) FROM sync_deletions WHERE owner_id = ${userId}::uuid) as total
    `);
    return Number(counts.rows[0]?.total || 0) > V1_SAFETY_THRESHOLD;
  },

  async getDeltas(db: DBConnection, userId: string, params: SyncParams): Promise<SyncResponse> {
    // If it's a large account, trigger the safety gate
    const isTooLarge = await this.checkV1PayloadSize(db, userId);
    if (isTooLarge) {
      return {
        habits: [],
        buckets: [],
        habitLogs: [],
        bucketLogs: [],
        deletions: [],
        serverTime: await getServerTime(db),
        forceUpdateRequired: true
      };
    }
    
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
      const syncDate = new Date(lastSynced as number);
      habitsFilters.push(gte(habitsTable.updatedAt, syncDate));
      bucketFilters.push(gte(bucketsTable.updatedAt, syncDate));
      habitLogsFilters.push(gte(habitLogs.updatedAt, syncDate));
      bucketLogsFilters.push(gte(bucketLogs.updatedAt, syncDate));
      deletionsFilters.push(gte(syncDeletions.createdAt, syncDate));
    } else if (startDate && endDate) {
      const s = startDate as string;
      const e = endDate as string;
      habitLogsFilters.push(gte(habitLogs.date, s));
      habitLogsFilters.push(lte(habitLogs.date, e));
      bucketLogsFilters.push(gte(bucketLogs.date, s));
      bucketLogsFilters.push(lte(bucketLogs.date, e));
    }

    // 1. Fetch main deltas in parallel (wrapped in transaction to use a single connection)
    const [habitsRes, bucketsRes, bucketHabitsRes, membersRes, habitLogsRes, bucketLogsRes, deletionsRes] = await db.transaction(async (tx: any) => {
      // Parallel fetch to avoid Cartesian product and OOM
      return await Promise.all([
        tx.select().from(habitsTable)
          .where(and(...habitsFilters)!)
          .orderBy(asc(habitsTable.sortOrder), desc(habitsTable.createdAt)),

        tx.select().from(bucketsTable)
          .where(and(...bucketFilters)!)
          .orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt)),

        tx.select({
          bh: bucketHabits,
          habitOwnerId: habitsTable.ownerId
        })
        .from(bucketHabits)
        .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
        .where(and(
          inArray(bucketHabits.bucketId, bucketIdsSubquery),
          or(
            isNull(bucketHabits.approvalStatus),
            ne(bucketHabits.approvalStatus, 'removed')
          ),
          or(
            eq(habitsTable.ownerId, userId),
            sql`${habitsTable.sharedWith} @> ARRAY[${userId}]::text[]`
          )
        )),

        tx.select({
          sbm: sharedBucketMembers,
          memberUsername: users.username
        })
        .from(sharedBucketMembers)
        .leftJoin(users, eq(sharedBucketMembers.userId, users.id))
        .where(inArray(sharedBucketMembers.bucketId, bucketIdsSubquery)),

        tx.select().from(habitLogs)
          .where(and(...habitLogsFilters)!),

        tx.select().from(bucketLogs)
          .where(and(...bucketLogsFilters)!),

        tx.select({ entityId: syncDeletions.entityId, entityType: syncDeletions.entityType })
          .from(syncDeletions)
          .where(and(...deletionsFilters)!)
      ]);
    });

    // 2. Aggregate bucket results (Stitch separate query results together)
    const normalizedBuckets = this.stitchBuckets(bucketsRes, bucketHabitsRes, membersRes);

    return {
      habits: habitsRes,
      buckets: normalizedBuckets,
      habitLogs: habitLogsRes,
      bucketLogs: bucketLogsRes,
      deletions: deletionsRes.map((d: any) => ({ id: d.entityId, type: d.entityType })),
      serverTime
    };
  },

  /**
   * Stitches together separate bucket, habit assignment, and member assignment queries
   * to avoid Cartesian product explosions while maintaining expected sync payload shape.
   */
  stitchBuckets(buckets: any[], habitAssignments: any[], memberAssignments: any[]): any[] {
    const bucketMap = new Map<string, any>();
    
    for (const b of buckets) {
      bucketMap.set(b.id, {
        ...b,
        habitIds: [],
        sharedMembers: [],
        sharedHabits: []
      });
    }

    for (const row of habitAssignments) {
      const entry = bucketMap.get(row.bh.bucketId);
      if (entry) {
        entry.habitIds.push(row.bh.habitId);
        entry.sharedHabits.push({
          habitId: row.bh.habitId,
          approvalStatus: row.bh.approvalStatus,
          addedBy: row.bh.addedBy,
          habitOwnerId: row.habitOwnerId
        });
      }
    }

    for (const row of memberAssignments) {
      const entry = bucketMap.get(row.sbm.bucketId);
      if (entry) {
        entry.sharedMembers.push({
          userId: row.sbm.userId,
          username: row.memberUsername,
          status: row.sbm.status
        });
      }
    }

    return Array.from(bucketMap.values());
  },

  async getHabitStreakBaselines(
    db: DBConnection,
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<HabitStreakBaseline[]> {
    const habitRows: HabitIdRow[] = await db.select({ id: habitsTable.id })
      .from(habitsTable)
      .where(eq(habitsTable.ownerId, userId));

    if (habitRows.length === 0) return [];

    const habitIds = habitRows.map((habit) => habit.id);
    const habitIdSql = sql.join(habitIds.map((id) => sql`${id}::uuid`), sql`, `);

    const baselineResult = await db.execute(sql`
      SELECT
        habit_id AS "habitId",
        streak_count AS "baselineCurrentStreak",
        max_streak AS "baselineLongestStreak",
        date AS "baselineStreakAnchorDate"
      FROM (
        SELECT
          habit_id,
          date,
          streak_count,
          MAX(streak_count) OVER (PARTITION BY habit_id) AS max_streak,
          ROW_NUMBER() OVER (PARTITION BY habit_id ORDER BY date DESC, updated_at DESC, id DESC) AS row_number
        FROM habit_logs
        WHERE owner_id = ${userId}::uuid
          AND habit_id IN (${habitIdSql})
          AND date < ${startDate}
          AND status <> 'cleared'
      ) AS prior_logs
      WHERE row_number = 1
    `);

    const baselineByHabitId = new Map<string, HabitBaselineRow>();
    for (const row of baselineResult.rows) {
      const habitId = toOptionalString(row.habitId);
      if (!habitId) continue;

      baselineByHabitId.set(habitId, {
        habitId,
        baselineCurrentStreak: toOptionalNumber(row.baselineCurrentStreak),
        baselineLongestStreak: toOptionalNumber(row.baselineLongestStreak),
        baselineStreakAnchorDate: toOptionalString(row.baselineStreakAnchorDate)
      });
    }

    const baselineDate = addDaysToDateString(startDate, -1);

    return habitIds.map((habitId) => {
      const baseline = baselineByHabitId.get(habitId);
      return {
        habitId,
        ownerId: userId,
        startDate,
        endDate,
        baselineDate,
        baselineCurrentStreak: baseline?.baselineCurrentStreak ?? 0,
        baselineLongestStreak: baseline?.baselineLongestStreak ?? 0,
        baselineStreakAnchorDate: baseline?.baselineStreakAnchorDate ?? null
      };
    });
  },

  async getPaginatedDeltas(db: DBConnection, userId: string, params: SyncParams): Promise<SyncResponse> {
    const { lastSynced = 0, limit = 50, cursors = {}, startDate, endDate } = params;
    const serverTime = await getServerTime(db);
    const isWindowedInitialSync = lastSynced === 0 && Boolean(startDate && endDate);

    const decodeCursor = (cursor?: string) => {
      if (!cursor) return null;
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
        if (!decoded.includes('|')) return 'INVALID';
        const parts = decoded.split('|');
        const ts = parts[0];
        const id = parts[1];
        if (!ts || !id) return 'INVALID';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return 'INVALID';
        return { ts: date, id };
      } catch {
        return 'INVALID';
      }
    };

    const encodeCursor = (ts: Date, id: string) => {
      return Buffer.from(`${ts.toISOString()}|${id}`).toString('base64');
    };

    const buildCursorFilter = (table: any, cursor: { ts: Date, id: string }, fallbackDate: Date) => {
      const tsCol = table.updatedAt || table.createdAt;
      return or(
        gt(tsCol, cursor.ts),
        and(eq(tsCol, cursor.ts), gt(table.id, cursor.id))
      );
    };

    const fallbackDate = new Date(lastSynced || 0);
    const habitCursor = decodeCursor(cursors?.habits);
    const bucketCursor = decodeCursor(cursors?.buckets);
    const logCursor = decodeCursor(cursors?.habitLogs);
    const bLogCursor = decodeCursor(cursors?.bucketLogs);
    const delCursor = decodeCursor(cursors?.deletions);

    // If any cursor is malformed, trigger a force update
    if ([habitCursor, bucketCursor, logCursor, bLogCursor, delCursor].includes('INVALID')) {
      return {
        habits: [],
        buckets: [],
        habitLogs: [],
        bucketLogs: [],
        deletions: [],
        serverTime: await getServerTime(db),
        forceUpdateRequired: true
      };
    }

    const [habitsResRaw, bucketIdsResRaw] = await db.transaction(async (tx: any) => {
      // Subquery to identify accessible bucket IDs (to avoid join duplicates)
      const bucketIdsSubquery = tx.select({ id: bucketsTable.id })
        .from(bucketsTable)
        .leftJoin(sharedBucketMembers, eq(bucketsTable.id, sharedBucketMembers.bucketId))
        .where(or(
          eq(bucketsTable.ownerId, userId),
          and(eq(sharedBucketMembers.userId, userId), eq(sharedBucketMembers.status, 'accepted'))
        ));

      return await Promise.all([
        tx.select().from(habitsTable)
          .where(and(
            eq(habitsTable.ownerId, userId),
            habitCursor ? buildCursorFilter(habitsTable, habitCursor as any, fallbackDate) : gte(habitsTable.updatedAt, fallbackDate)
          ))
          .orderBy(asc(habitsTable.updatedAt), asc(habitsTable.id))
          .limit(limit + 1),
        
        tx.select({ id: bucketsTable.id }).from(bucketsTable)
          .where(and(
            inArray(bucketsTable.id, bucketIdsSubquery),
            bucketCursor ? buildCursorFilter(bucketsTable, bucketCursor as any, fallbackDate) : gte(bucketsTable.updatedAt, fallbackDate)
          ))
          .orderBy(asc(bucketsTable.updatedAt), asc(bucketsTable.id))
          .limit(limit + 1)
      ]);
    });

    const habitsHasMore = habitsResRaw.length > limit;
    const habitsRes = habitsResRaw.slice(0, limit);
    
    const bucketsHasMore = bucketIdsResRaw.length > limit;
    const bucketIds = bucketIdsResRaw.slice(0, limit).map((b: any) => b.id);

    // 3. Topological Suppression: If parents have more, don't fetch children yet
    const suppressChildren = habitsHasMore || bucketsHasMore;

    let habitLogsRes: any[] = [];
    let bucketLogsRes: any[] = [];
    let deletionsRes: any[] = [];
    let normalizedBuckets: any[] = [];
    let logsHasMore = false;
    let deletionsHasMore = false;

    let habitStreakBaselines: HabitStreakBaseline[] = [];

    if (!suppressChildren) {
      const habitLogFilters = [eq(habitLogs.ownerId, userId)];
      const bucketLogFilters = [eq(bucketLogs.ownerId, userId)];

      if (isWindowedInitialSync && startDate && endDate) {
        habitLogFilters.push(gte(habitLogs.date, startDate), lte(habitLogs.date, endDate));
        bucketLogFilters.push(gte(bucketLogs.date, startDate), lte(bucketLogs.date, endDate));
      }

      if (logCursor) {
        habitLogFilters.push(buildCursorFilter(habitLogs, logCursor as { ts: Date, id: string }, fallbackDate)!);
      } else if (!isWindowedInitialSync) {
        habitLogFilters.push(gte(habitLogs.updatedAt, fallbackDate));
      }

      if (bLogCursor) {
        bucketLogFilters.push(buildCursorFilter(bucketLogs, bLogCursor as { ts: Date, id: string }, fallbackDate)!);
      } else if (!isWindowedInitialSync) {
        bucketLogFilters.push(gte(bucketLogs.updatedAt, fallbackDate));
      }

      const [hLogs, bLogs, deletionsRaw] = await db.transaction(async (tx: any) => {
        return await Promise.all([
          tx.select().from(habitLogs)
            .where(and(...habitLogFilters)!)
            .orderBy(asc(habitLogs.updatedAt), asc(habitLogs.id))
            .limit(limit + 1),

          tx.select().from(bucketLogs)
            .where(and(...bucketLogFilters)!)
            .orderBy(asc(bucketLogs.updatedAt), asc(bucketLogs.id))
            .limit(limit + 1),

          tx.select().from(syncDeletions)
            .where(and(
              eq(syncDeletions.ownerId, userId),
              delCursor ? buildCursorFilter(syncDeletions, delCursor as { ts: Date, id: string }, fallbackDate) : gte(syncDeletions.createdAt, fallbackDate)
            ))
            .orderBy(asc(syncDeletions.createdAt), asc(syncDeletions.id))
            .limit(limit + 1)
        ]);
      });

      logsHasMore = hLogs.length > limit || bLogs.length > limit;
      deletionsHasMore = deletionsRaw.length > limit;
      
      habitLogsRes = hLogs.slice(0, limit);
      bucketLogsRes = bLogs.slice(0, limit);
      deletionsRes = deletionsRaw.slice(0, limit);

      if (isWindowedInitialSync && startDate && endDate) {
        habitStreakBaselines = await this.getHabitStreakBaselines(db, userId, startDate, endDate);
      }
    }

    // Fetch Bucket Details if we have IDs
    if (bucketIds.length > 0) {
      const [rawBuckets, habitAssignments, memberAssignments] = await db.transaction(async (tx: any) => {
        return await Promise.all([
          tx.select().from(bucketsTable)
            .where(inArray(bucketsTable.id, bucketIds))
            .orderBy(asc(bucketsTable.updatedAt), asc(bucketsTable.id)),
          
          tx.select({
            bh: bucketHabits,
            habitOwnerId: habitsTable.ownerId
          })
          .from(bucketHabits)
          .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
          .where(and(
            inArray(bucketHabits.bucketId, bucketIds),
            or(
              isNull(bucketHabits.approvalStatus),
              ne(bucketHabits.approvalStatus, 'removed')
            ),
            or(
              eq(habitsTable.ownerId, userId),
              sql`${habitsTable.sharedWith} @> ARRAY[${userId}]::text[]`
            )
          )),

          tx.select({
            sbm: sharedBucketMembers,
            memberUsername: users.username
          })
          .from(sharedBucketMembers)
          .leftJoin(users, eq(sharedBucketMembers.userId, users.id))
          .where(inArray(sharedBucketMembers.bucketId, bucketIds))
        ]);
      });

      normalizedBuckets = this.stitchBuckets(rawBuckets, habitAssignments, memberAssignments);
    }

    const nextCursors: Record<string, string> = {};
    if (habitsRes.length > 0) {
      nextCursors.habits = encodeCursor(habitsRes[habitsRes.length - 1].updatedAt, habitsRes[habitsRes.length - 1].id);
    } else if (habitCursor) {
      nextCursors.habits = cursors.habits!;
    }

    if (normalizedBuckets.length > 0) {
      nextCursors.buckets = encodeCursor(normalizedBuckets[normalizedBuckets.length - 1].updatedAt, normalizedBuckets[normalizedBuckets.length - 1].id);
    } else if (bucketCursor) {
      nextCursors.buckets = cursors.buckets!;
    }

    if (habitLogsRes.length > 0) {
      nextCursors.habitLogs = encodeCursor(habitLogsRes[habitLogsRes.length - 1].updatedAt, habitLogsRes[habitLogsRes.length - 1].id);
    } else if (logCursor) {
      nextCursors.habitLogs = cursors.habitLogs!;
    }

    if (bucketLogsRes.length > 0) {
      nextCursors.bucketLogs = encodeCursor(bucketLogsRes[bucketLogsRes.length - 1].updatedAt, bucketLogsRes[bucketLogsRes.length - 1].id);
    } else if (bLogCursor) {
      nextCursors.bucketLogs = cursors.bucketLogs!;
    }

    if (deletionsRes.length > 0) {
      nextCursors.deletions = encodeCursor(deletionsRes[deletionsRes.length - 1].createdAt, deletionsRes[deletionsRes.length - 1].id);
    } else if (delCursor) {
      nextCursors.deletions = cursors.deletions!;
    }

    return {
      habits: habitsRes,
      buckets: normalizedBuckets,
      habitLogs: habitLogsRes,
      bucketLogs: bucketLogsRes,
      deletions: deletionsRes.map((d: any) => ({ id: d.entityId, type: d.entityType })),
      habitStreakBaselines,
      serverTime,
      nextCursors,
      hasMore: habitsHasMore || bucketsHasMore || logsHasMore || deletionsHasMore
    };
  }
};
