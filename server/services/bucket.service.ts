import { eq, and, inArray } from 'drizzle-orm';
import { buckets as bucketsTable, bucketHabits, habits as habitsTable, syncDeletions, bucketLogs } from '~~/server/db/schema';
import { reevaluateMultipleBuckets } from '~~/server/utils/buckets';
import type { DBConnection } from '../types/db';

export const BucketService = {
  async logBucket(db: DBConnection, userId: string, data: any, event: any) {
    const logId = data.id || `${data.bucketId}_${data.date}`;

    try {
      const result = await db.insert(bucketLogs)
        .values({
          id: logId,
          bucketId: data.bucketId,
          ownerId: userId,
          date: data.date,
          status: data.status,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: bucketLogs.id,
          set: {
            status: data.status,
            updatedAt: new Date()
          },
          where: eq(bucketLogs.ownerId, userId)
        })
        .returning();

      if (!result[0]) {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Bucket log already exists or ownership mismatch' });
      }

      return result[0];
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  },

  async updateBucket(db: DBConnection, userId: string, id: string, data: any, bucket: any, event: any) {
    const resultData = await db.transaction(async (tx: any) => {
      const result = await tx.update(bucketsTable)
        .set({
          title: data.title ?? bucket.title,
          description: data.description ?? bucket.description,
          color: data.color ?? bucket.color,
          sortOrder: data.sortOrder ?? bucket.sortOrder,
          updatedAt: new Date()
        })
        .where(and(eq(bucketsTable.id, id), eq(bucketsTable.ownerId, userId)))
        .returning();

      if (result.length === 0) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this bucket' });
      }

      const updatedBucket = result[0];

      if (data.habitIds !== undefined) {
        const habitIds = data.habitIds as string[];
        let validIds: string[] = [];

        if (habitIds.length > 0) {
          const ownHabits = await tx.select({ id: habitsTable.id })
            .from(habitsTable)
            .where(and(
              inArray(habitsTable.id, habitIds),
              eq(habitsTable.ownerId, userId)
            ));
          validIds = ownHabits.map((h: any) => h.id);
        }

        await tx.delete(bucketHabits).where(eq(bucketHabits.bucketId, id));

        if (validIds.length > 0) {
          await tx.insert(bucketHabits)
            .values(validIds.map(hid => ({
              bucketId: id,
              habitId: hid
            })))
            .onConflictDoNothing();
        }

        await reevaluateMultipleBuckets(tx, [{ bucketId: id, ownerId: userId }]);
      }

      const habitsResult = await tx.select({ habitId: bucketHabits.habitId })
        .from(bucketHabits)
        .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
        .where(and(
          eq(bucketHabits.bucketId, id),
          eq(habitsTable.ownerId, userId)
        ));

      return { ...updatedBucket, habitIds: habitsResult.map((h: any) => h.habitId) };
    });

    return resultData;
  },

  async deleteBucket(db: DBConnection, userId: string, id: string, event: any) {
    await db.transaction(async (tx: any) => {
      // Fetch before delete to verify ownership and get true ownerId for sync attribution
      const records = await tx.select({ ownerId: bucketsTable.ownerId })
        .from(bucketsTable)
        .where(eq(bucketsTable.id, id));
      
      if (records.length === 0) {
        throw createError({ statusCode: 404, statusMessage: 'Bucket not found' });
      }

      const bucket = records[0];
      if (bucket.ownerId !== userId) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not own this bucket' });
      }

      await tx.delete(bucketHabits).where(eq(bucketHabits.bucketId, id));
      await tx.delete(bucketsTable).where(eq(bucketsTable.id, id));
      
      await tx.insert(syncDeletions)
        .values({
          id: crypto.randomUUID(),
          ownerId: bucket.ownerId,
          entityId: id,
          entityType: 'bucket',
          createdAt: new Date()
        });
    });
  }
};
