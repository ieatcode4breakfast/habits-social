import { defineEventHandler, createError, readBody } from 'h3';
import { useDB } from '~~/server/utils/db';
import { requireAuth } from '~~/server/utils/auth';
import { z } from 'zod';
import { habitSchema, bucketSchema, habitLogSchema, bucketLogSchema, throwZodError } from '~~/server/utils/validation';
import * as schema from '~~/server/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { BucketService } from '~~/server/services/bucket.service';

const bulkSyncSchema = z.object({
  operations: z.array(z.object({ type: z.string(), data: z.any() })).max(100)
});

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);
  
  const contentLength = event.node?.req?.headers?.['content-length'];
  if (contentLength && parseInt(contentLength as string) > 1024 * 1024) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Payload Too Large',
    });
  }

  const body = (event as any)._body || await readBody(event);

  const validation = bulkSyncSchema.safeParse(body);
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { operations } = validation.data;

  const success: string[] = [];
  const failed: { id: string, code: string }[] = [];
  
  const validHabits: any[] = [];
  const validBuckets: any[] = [];
  const validLogs: any[] = [];
  const validBucketLogs: any[] = [];

  const failedHabitIds = new Set<string>();
  const failedBucketIds = new Set<string>();

  // 1. Validation Pass
  for (const op of operations) {
    const { type, data } = op;
    const id = data?.id;

    if (!id) {
      failed.push({ id: 'unknown', code: 'MISSING_ID' });
      continue;
    }

    try {
      if (type === 'habit') {
        const itemValidation = habitSchema.extend({ id: z.string() }).safeParse(data);
        if (!itemValidation.success) {
          failed.push({ id, code: 'VALIDATION_FAILED' });
          failedHabitIds.add(id);
          continue;
        }
        validHabits.push(itemValidation.data);
      } else if (type === 'bucket') {
        const itemValidation = bucketSchema.extend({ id: z.string() }).safeParse(data);
        if (!itemValidation.success) {
          failed.push({ id, code: 'VALIDATION_FAILED' });
          failedBucketIds.add(id);
          continue;
        }
        validBuckets.push(itemValidation.data);
      } else if (type === 'log') {
        const itemValidation = habitLogSchema.extend({ id: z.string() }).safeParse(data);
        if (!itemValidation.success) {
          failed.push({ id, code: 'VALIDATION_FAILED' });
          continue;
        }
        validLogs.push(itemValidation.data);
      } else if (type === 'bucketLog') {
        const itemValidation = bucketLogSchema.extend({ id: z.string() }).safeParse(data);
        if (!itemValidation.success) {
          failed.push({ id, code: 'VALIDATION_FAILED' });
          continue;
        }
        validBucketLogs.push(itemValidation.data);
      } else {
        failed.push({ id, code: 'INVALID_TYPE' });
      }
    } catch (error) {
      failed.push({ id, code: 'ERROR' });
    }
  }

  // 2. Dependency Check (Static)
  const finalLogs = validLogs.filter(l => {
    if (failedHabitIds.has(l.habitId)) {
      failed.push({ id: l.id, code: 'DEPENDENCY_FAILED' });
      return false;
    }
    return true;
  });

  const finalBucketLogs = validBucketLogs.filter(l => {
    if (failedBucketIds.has(l.bucketId)) {
      failed.push({ id: l.id, code: 'DEPENDENCY_FAILED' });
      return false;
    }
    return true;
  });

  // 3. Database Pass (Set-Based)

  // Habits
  if (validHabits.length > 0) {
    const habitsToInsert = validHabits.map(h => ({ ...h, ownerId: userId, updatedAt: new Date() }));
    const result = await db.insert(schema.habits)
      .values(habitsToInsert)
      .onConflictDoUpdate({
        target: schema.habits.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          color: sql`excluded.color`,
          skipsCount: sql`excluded.skips_count`,
          skipsPeriod: sql`excluded.skips_period`,
          sharedWith: sql`excluded.shared_with`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date()
        },
        where: eq(schema.habits.ownerId, userId)
      })
      .returning({ id: schema.habits.id });

    const returnedIds = new Set(result.map((r: { id: string }) => r.id));
    for (const h of validHabits) {
      if (returnedIds.has(h.id)) success.push(h.id);
      else failed.push({ id: h.id, code: 'UNAUTHORIZED' });
    }
  }

  // Buckets
  if (validBuckets.length > 0) {
    const bucketsToInsert = validBuckets.map(({ habitIds, ...b }) => ({
      ...b,
      ownerId: userId,
      updatedAt: new Date()
    }));

    const result = await db.insert(schema.buckets)
      .values(bucketsToInsert)
      .onConflictDoUpdate({
        target: schema.buckets.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          color: sql`excluded.color`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date()
        },
        where: eq(schema.buckets.ownerId, userId)
      })
      .returning({ id: schema.buckets.id });

    const returnedIds = new Set(result.map((r: { id: string }) => r.id));
    for (const b of validBuckets) {
      if (returnedIds.has(b.id)) {
        success.push(b.id);

        // Conditional Delegation: Only call updateBucket if habitIds is provided
        if (b.habitIds !== undefined) {
          try {
            const [fetchedBucket] = await db.select().from(schema.buckets).where(eq(schema.buckets.id, b.id));
            if (fetchedBucket) {
              await BucketService.updateBucket(db, userId, b.id, { habitIds: b.habitIds }, fetchedBucket, event);
            }
          } catch (error) {
            console.error(`[Bulk Sync] Failed to update habits for bucket ${b.id}:`, error);
          }
        }
      } else {
        failed.push({ id: b.id, code: 'UNAUTHORIZED' });
      }
    }
  }

  // Logs
  if (finalLogs.length > 0) {
    const habitIdsToCheck = [...new Set(finalLogs.map(l => l.habitId))];
    const existingHabits = await db.select({ id: schema.habits.id })
      .from(schema.habits)
      .where(and(eq(schema.habits.ownerId, userId), inArray(schema.habits.id, habitIdsToCheck)));
    
    const validHabitIdsInDB = new Set(existingHabits.map((h: { id: string }) => h.id));
    
    const logsToInsert: any[] = [];
    for (const l of finalLogs) {
      if (success.includes(l.habitId) || validHabitIdsInDB.has(l.habitId)) {
        logsToInsert.push({ ...l, ownerId: userId, updatedAt: new Date() });
      } else {
        failed.push({ id: l.id, code: 'DEPENDENCY_FAILED' });
      }
    }

    if (logsToInsert.length > 0) {
      const result = await db.insert(schema.habitLogs)
        .values(logsToInsert)
        .onConflictDoUpdate({
          target: schema.habitLogs.id,
          set: {
            status: sql`excluded.status`,
            sharedWith: sql`excluded.shared_with`,
            updatedAt: new Date()
          },
          where: eq(schema.habitLogs.ownerId, userId)
        })
        .returning({ id: schema.habitLogs.id });

      const returnedIds = new Set(result.map((r: { id: string }) => r.id));
      for (const l of logsToInsert) {
        if (returnedIds.has(l.id)) success.push(l.id);
        else failed.push({ id: l.id, code: 'UNAUTHORIZED' });
      }
    }
  }

  // Bucket Logs
  if (finalBucketLogs.length > 0) {
    const bucketIdsToCheck = [...new Set(finalBucketLogs.map(l => l.bucketId))];
    const existingBuckets = await db.select({ id: schema.buckets.id })
      .from(schema.buckets)
      .where(and(eq(schema.buckets.ownerId, userId), inArray(schema.buckets.id, bucketIdsToCheck)));
    
    const validBucketIdsInDB = new Set(existingBuckets.map((b: { id: string }) => b.id));
    
    const logsToInsert: any[] = [];
    for (const l of finalBucketLogs) {
      if (success.includes(l.bucketId) || validBucketIdsInDB.has(l.bucketId)) {
        logsToInsert.push({ ...l, ownerId: userId, updatedAt: new Date() });
      } else {
        failed.push({ id: l.id, code: 'DEPENDENCY_FAILED' });
      }
    }

    if (logsToInsert.length > 0) {
      const result = await db.insert(schema.bucketLogs)
        .values(logsToInsert)
        .onConflictDoUpdate({
          target: schema.bucketLogs.id,
          set: {
            status: sql`excluded.status`,
            updatedAt: new Date()
          },
          where: eq(schema.bucketLogs.ownerId, userId)
        })
        .returning({ id: schema.bucketLogs.id });

      const returnedIds = new Set(result.map((r: { id: string }) => r.id));
      for (const l of logsToInsert) {
        if (returnedIds.has(l.id)) success.push(l.id);
        else failed.push({ id: l.id, code: 'UNAUTHORIZED' });
      }
    }
  }

  return { success, failed };
});
