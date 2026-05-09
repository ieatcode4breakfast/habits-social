import { eq, and, or, sql, inArray, notInArray, ne } from 'drizzle-orm';
import { buckets as bucketsTable, bucketHabits, habits as habitsTable, friendships, sharedBucketMembers, syncDeletions, bucketLogs } from '~~/server/db/schema';
import { reevaluateBucketLogs } from '~~/server/utils/buckets';
import { usePusher } from '~~/server/utils/pusher';

export const BucketService = {
  async logBucket(db: any, userId: string, data: any, event: any) {
    const logId = data.id || `${data.bucketId}_${data.date}`;

    try {
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

      if (!result[0]) {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Bucket log already exists or ownership mismatch' });
      }

      const pusher = usePusher(event);
      if (pusher) {
        pusher.trigger(`user-${userId}-buckets`, 'sync-settled', { timestamp: Date.now() });
      }

      return result[0];
    } catch (e: any) {
      if (e.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: 'Conflict: Unique constraint violation' });
      }
      throw e;
    }
  },

  async updateBucket(db: any, userId: string, id: string, data: any, bucket: any, event: any) {
    const resultData = await db.transaction(async (tx: any) => {
      const result = await tx.update(bucketsTable)
        .set({
          title: data.title ?? bucket.title,
          description: data.description ?? bucket.description,
          color: data.color ?? bucket.color,
          sortOrder: data.sortOrder ?? bucket.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(bucketsTable.id, id))
        .returning();

      const updatedBucket = result[0];

      if (data.habitIds !== undefined) {
        const habitIds = data.habitIds as string[];
        
        const foreignHabitRows: any[] = [];
        const ownHabitIds: string[] = [];

        let habitsInfo: any[] = [];
        if (habitIds.length > 0) {
          habitsInfo = await tx.select().from(habitsTable).where(inArray(habitsTable.id, habitIds));
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
          const friendshipsRes = await tx.select()
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
          await tx.update(bucketHabits)
            .set({ approvalStatus: 'removed' })
            .where(and(
              eq(bucketHabits.bucketId, id),
              notInArray(bucketHabits.habitId, habitIds)
            ));
        } else {
          await tx.update(bucketHabits)
            .set({ approvalStatus: 'removed' })
            .where(eq(bucketHabits.bucketId, id));
        }

        // Add own habits
        for (const hid of ownHabitIds) {
          await tx.insert(bucketHabits)
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
          await tx.insert(bucketHabits)
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

        // Manage members
        for (const foreignOwnerId of uniqueForeignOwners) {
          await tx.insert(sharedBucketMembers)
            .values({
              bucketId: id,
              userId: foreignOwnerId,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .onConflictDoNothing();
        }

        const currentMembers = await tx.select({ userId: sharedBucketMembers.userId })
          .from(sharedBucketMembers)
          .where(and(
            eq(sharedBucketMembers.bucketId, id),
            ne(sharedBucketMembers.userId, userId)
          ));

        for (const member of currentMembers) {
          const memberId = member.userId;
          const activeHabits = await tx.select({ habitId: bucketHabits.habitId })
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
            await tx.delete(sharedBucketMembers)
              .where(and(
                eq(sharedBucketMembers.bucketId, id),
                eq(sharedBucketMembers.userId, memberId)
              ));
          }
        }

        await reevaluateBucketLogs(tx, id, userId);
      }

      const habitsResult = await tx.select({ habitId: bucketHabits.habitId })
        .from(bucketHabits)
        .where(and(
          eq(bucketHabits.bucketId, id),
          or(
            sql`${bucketHabits.approvalStatus} IS NULL`,
            inArray(bucketHabits.approvalStatus, ['accepted', 'pending'])
          )
        ));

      return { ...updatedBucket, habitIds: habitsResult.map((h: any) => h.habitId) };
    });

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', { bucketId: id });
    }

    return resultData;
  },

  async deleteBucket(db: any, userId: string, id: string, event: any) {
    await db.transaction(async (tx: any) => {
      await tx.delete(sharedBucketMembers).where(eq(sharedBucketMembers.bucketId, id));
      await tx.delete(bucketHabits).where(eq(bucketHabits.bucketId, id));
      await tx.delete(bucketsTable).where(eq(bucketsTable.id, id));
      
      await tx.insert(syncDeletions)
        .values({
          id: crypto.randomUUID(),
          ownerId: userId,
          entityId: id,
          entityType: 'bucket',
          createdAt: new Date()
        });
    });

    const pusher = usePusher(event);
    if (pusher) {
      pusher.trigger(`user-${userId}-buckets`, 'bucket-deleted', { bucketId: id });
    }
  }
};
