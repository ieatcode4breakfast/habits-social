import { eq, and, or, sql, inArray, notInArray, ne } from 'drizzle-orm';
import { buckets as bucketsTable, bucketHabits, habits as habitsTable, friendships, syncDeletions } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { bucketUpdateSchema } from '~~/server/utils/validation';

import { BucketService } from '~~/server/services/bucket.service';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const db = useDB(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const bucketsRes = await db.select()
    .from(bucketsTable)
    .where(and(eq(bucketsTable.id, id), eq(bucketsTable.ownerId, userId)));

  if (bucketsRes.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const bucket = bucketsRes[0];

  if (event.method === 'GET') {
    const habitsRes = await db.select({ habitId: bucketHabits.habitId })
      .from(bucketHabits)
      .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
      .where(and(
        eq(bucketHabits.bucketId, id),
        eq(habitsTable.ownerId, userId)
      ));
    return { data: { ...bucket, habitIds: habitsRes.map((h: any) => h.habitId) } };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = bucketUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const updatedBucketWithHabits = await BucketService.updateBucket(db, userId, id, validation.data, bucket, event);
    
    return { data: updatedBucketWithHabits };
  }

  if (event.method === 'DELETE') {
    await BucketService.deleteBucket(db, userId, id, event);
    return { data: { success: true } };
  }
});
