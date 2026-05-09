import { eq, and, gte, asc, desc, sql, inArray } from 'drizzle-orm';
import { buckets as bucketsTable, bucketHabits, habits as habitsTable } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { bucketSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    const q = db.select().from(bucketsTable).where(eq(bucketsTable.ownerId, userId));

    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      q.where(and(eq(bucketsTable.ownerId, userId), gte(bucketsTable.updatedAt, new Date(lastSynced))));
    }

    const buckets = await q.orderBy(asc(bucketsTable.sortOrder), desc(bucketsTable.createdAt));

    if (buckets.length === 0) return { data: [] };

    const bucketIds = buckets.map((b: any) => b.id);
    const habitsRes = await db.select({
      bucketId: bucketHabits.bucketId,
      habitId: bucketHabits.habitId
    })
    .from(bucketHabits)
    .where(inArray(bucketHabits.bucketId, bucketIds));

    const bucketsWithHabits = buckets.map((b: any) => ({
      ...b,
      habitIds: habitsRes.filter((bh: any) => bh.bucketId === b.id).map((bh: any) => bh.habitId)
    }));

    return { data: bucketsWithHabits };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = bucketSchema.safeParse(body);
    if (!validation.success) {
      return throwZodError(validation.error);
    }

    const data = validation.data;
    const nextSortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Bucket limit of 30 reached' });
    }

    const bucketId = data.id || crypto.randomUUID();

    try {
      const result = await db.insert(bucketsTable)
        .values({
          id: bucketId,
          ownerId: userId,
          title: data.title,
          description: data.description || '',
          color: data.color || '#6366f1',
          sortOrder: nextSortOrder,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: bucketsTable.id,
          set: {
            title: data.title,
            description: data.description || '',
            color: data.color || '#6366f1',
            sortOrder: nextSortOrder,
            updatedAt: new Date()
          },
          where: eq(bucketsTable.ownerId, userId)
        })
        .returning();

      const newBucket = result[0];
      if (!newBucket) {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Bucket already exists or ownership mismatch' });
      }

    // Manage bucket_habits
    if (data.habitIds && data.habitIds.length > 0) {
      // Validate habits exist and belong to user
      const validHabits = await db.select({ id: habitsTable.id })
        .from(habitsTable)
        .where(and(inArray(habitsTable.id, data.habitIds), eq(habitsTable.ownerId, userId)));
      
      const validIds = validHabits.map((h: any) => h.id);

      // Manage bucket_habits in batch
      if (validIds.length > 0) {
        await db.delete(bucketHabits).where(eq(bucketHabits.bucketId, newBucket.id));
        await db.insert(bucketHabits)
          .values(validIds.map(hid => ({
            bucketId: newBucket.id,
            habitId: hid
          })))
          .onConflictDoNothing();
      }
    }

    const habitsData = await db.select({ habitId: bucketHabits.habitId })
      .from(bucketHabits)
      .where(eq(bucketHabits.bucketId, newBucket.id));

    return { data: { ...newBucket, habitIds: habitsData.map((h: any) => h.habitId) } };
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  }
});
