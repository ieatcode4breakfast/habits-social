import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { bucketLogs, buckets as bucketsTable } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeLog } from '~~/server/utils/normalize';
import { bucketLogSchema } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    const q = db.select().from(bucketLogs).where(eq(bucketLogs.ownerId, userId));

    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      q.where(and(eq(bucketLogs.ownerId, userId), gte(bucketLogs.updatedAt, new Date(lastSynced))));
    } else if (query.startDate && query.endDate) {
      q.where(and(
        eq(bucketLogs.ownerId, userId),
        gte(bucketLogs.date, String(query.startDate)),
        lte(bucketLogs.date, String(query.endDate))
      ));
    }

    const logs = await q;
    return { data: logs.map(normalizeLog) };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = bucketLogSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    // Validate bucket exists and is owned by user
    const bucketCheck = await db.select({ id: bucketsTable.id })
      .from(bucketsTable)
      .where(and(eq(bucketsTable.id, data.bucketId), eq(bucketsTable.ownerId, userId)));
    
    if (bucketCheck.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Bucket not found' });
    }

    const logId = data.id || `${data.bucketId}_${data.date}`;

    const result = await db.insert(bucketLogs)
      .values({
        id: logId,
        bucketId: data.bucketId,
        ownerId: userId,
        date: data.date,
        status: data.status,
        streakCount: data.streakCount ?? 0,
        brokenStreakCount: data.brokenStreakCount ?? 0,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: bucketLogs.id,
        set: {
          status: data.status,
          streakCount: data.streakCount ?? 0,
          brokenStreakCount: data.brokenStreakCount ?? 0,
          updatedAt: new Date()
        },
        where: eq(bucketLogs.ownerId, userId)
      })
      .returning();

    return { data: normalizeLog(result[0]) };
  }

  if (event.method === 'DELETE') {
    // Bucket logs are synthesized server-side based on habit logs.
    // We treat explicit client deletions as a no-op to protect server derived data.
    return { data: { success: true } };
  }
});
