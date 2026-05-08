import { eq, and, or, sql, inArray, notInArray, ne } from 'drizzle-orm';
import { buckets as bucketsTable, bucketHabits, habits as habitsTable, friendships, sharedBucketMembers, syncDeletions } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeBucket, normalizeHabit } from '~~/server/utils/normalize';
import { bucketUpdateSchema } from '~~/server/utils/validation';
import { reevaluateBucketLogs } from '~~/server/utils/buckets';

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
      .where(and(
        eq(bucketHabits.bucketId, id),
        or(
          sql`${bucketHabits.approvalStatus} IS NULL`,
          inArray(bucketHabits.approvalStatus, ['accepted', 'pending'])
        )
      ));
    return { data: { ...bucket, habitIds: habitsRes.map((h: any) => h.habitId) } };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = bucketUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    const result = await db.update(bucketsTable)
      .set({
        title: data.title ?? bucket.title,
        description: data.description ?? bucket.description,
        color: data.color ?? bucket.color,
        sortOrder: data.sortOrder ?? bucket.sortOrder,
        updatedAt: new Date()
      })
      .where(eq(bucketsTable.id, id))
      .returning();

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedBucket = result[0];

    if (data.habitIds !== undefined) {
      const habitIds = data.habitIds as string[];
      
      const foreignHabitRows: any[] = [];
      const ownHabitIds: string[] = [];

      let habitsInfo: any[] = [];
      if (habitIds.length > 0) {
        habitsInfo = await db.select().from(habitsTable).where(inArray(habitsTable.id, habitIds));
      }

      for (const hid of habitIds) {
        const h = habitsInfo.find((h: any) => h.id === hid);
        if (h) {
          if (h.ownerId !== userId) {
            foreignHabitRows.push(h);
          } else {
            ownHabitIds.push(hid);
          }
        }
      }

      const validForeignHabits = [];
      const uniqueForeignOwners = new Set<string>();

      if (foreignHabitRows.length > 0) {
        const foreignOwnerIds = [...new Set(foreignHabitRows.map(h => h.ownerId))];
        const friendshipsRes = await db.select()
          .from(friendships)
          .where(and(
            eq(friendships.status, 'accepted'),
            or(
              and(eq(friendships.initiatorId, userId), inArray(friendships.receiverId, foreignOwnerIds)),
              and(eq(friendships.receiverId, userId), inArray(friendships.initiatorId, foreignOwnerIds))
            )
          ));

        for (const h of foreignHabitRows) {
          const isFriend = friendshipsRes.some((f: any) => 
            (f.initiatorId === userId && f.receiverId === h.ownerId) ||
            (f.receiverId === userId && f.initiatorId === h.ownerId)
          );
          const isSharedWithMe = h.sharedWith && h.sharedWith.includes(userId);

          if (isFriend && isSharedWithMe) {
            validForeignHabits.push(h);
            uniqueForeignOwners.add(h.ownerId);
          }
        }
      }

      // Update removed habits
      if (habitIds.length > 0) {
        await db.update(bucketHabits)
          .set({ approvalStatus: 'removed' })
          .where(and(
            eq(bucketHabits.bucketId, id),
            notInArray(bucketHabits.habitId, habitIds)
          ));
      } else {
        await db.update(bucketHabits)
          .set({ approvalStatus: 'removed' })
          .where(eq(bucketHabits.bucketId, id));
      }

      // Add own habits
      for (const hid of ownHabitIds) {
        await db.insert(bucketHabits)
          .values({
            bucketId: id,
            habitId: hid,
            addedBy: userId as any,
            approvalStatus: 'accepted'
          })
          .onConflictDoUpdate({
            target: [bucketHabits.bucketId, bucketHabits.habitId],
            set: {
              approvalStatus: 'accepted',
              addedBy: userId as any
            }
          });
      }

      // Add foreign habits
      for (const h of validForeignHabits) {
        await db.insert(bucketHabits)
          .values({
            bucketId: id,
            habitId: h.id,
            addedBy: userId as any,
            approvalStatus: 'pending'
          })
          .onConflictDoUpdate({
            target: [bucketHabits.bucketId, bucketHabits.habitId],
            set: {
              approvalStatus: sql`CASE WHEN bucket_habits.approval_status = 'accepted' THEN 'accepted' ELSE 'pending' END`,
              addedBy: userId as any
            }
          });
      }

      // Manage shared_bucket_members - Invites
      for (const foreignOwnerId of uniqueForeignOwners) {
        await db.insert(sharedBucketMembers)
          .values({
            bucketId: id,
            userId: foreignOwnerId,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .onConflictDoNothing();
      }

      // Manage shared_bucket_members - Evictions
      const currentMembers = await db.select({ userId: sharedBucketMembers.userId })
        .from(sharedBucketMembers)
        .where(and(
          eq(sharedBucketMembers.bucketId, id),
          ne(sharedBucketMembers.userId, userId)
        ));

      for (const member of currentMembers) {
        const memberId = member.userId;
        const activeHabits = await db.select({ habitId: bucketHabits.habitId })
          .from(bucketHabits)
          .innerJoin(habitsTable, eq(bucketHabits.habitId, habitsTable.id))
          .where(and(
            eq(bucketHabits.bucketId, id),
            eq(habitsTable.ownerId, memberId),
            or(
              sql`${bucketHabits.approvalStatus} IS NULL`,
              inArray(bucketHabits.approvalStatus, ['accepted', 'pending'])
            )
          ));

        if (activeHabits.length === 0) {
          await db.delete(sharedBucketMembers)
            .where(and(
              eq(sharedBucketMembers.bucketId, id),
              eq(sharedBucketMembers.userId, memberId)
            ));
        }
      }

      await reevaluateBucketLogs(db, id as string, userId);
    }

    const habitsResult = await db.select({ habitId: bucketHabits.habitId })
      .from(bucketHabits)
      .where(and(
        eq(bucketHabits.bucketId, id),
        or(
          sql`${bucketHabits.approvalStatus} IS NULL`,
          inArray(bucketHabits.approvalStatus, ['accepted', 'pending'])
        )
      ));
    
    return { data: { ...updatedBucket, habitIds: habitsResult.map((h: any) => h.habitId) } };
  }

  if (event.method === 'DELETE') {
    await db.delete(sharedBucketMembers).where(eq(sharedBucketMembers.bucketId, id));
    await db.delete(bucketHabits).where(eq(bucketHabits.bucketId, id));
    await db.delete(bucketsTable).where(eq(bucketsTable.id, id));
    
    await db.insert(syncDeletions)
      .values({
        id: crypto.randomUUID(),
        ownerId: userId,
        entityId: id,
        entityType: 'bucket',
        createdAt: new Date()
      });

    return { data: { success: true } };
  }
});
