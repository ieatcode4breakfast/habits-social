import { format } from 'date-fns';
import type { IBucket } from '../../models';
import { usePusher } from '../../utils/pusher';
import { reevaluateBucketLogs } from '../../utils/buckets';

const normalizeBucket = (b: any) => {
  if (!b) return b;
  const normalized = { ...b };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    try {
      setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
      const query = getQuery(event);
      let userBuckets;

      if (query.lastSynced) {
        const lastSynced = Number(query.lastSynced);
        // Personal buckets
        const personalBuckets = await sql`
          SELECT b.* FROM buckets b
          WHERE b.ownerid = ${userId} 
            AND b.updatedat >= to_timestamp(${lastSynced} / 1000.0)
            AND NOT EXISTS (SELECT 1 FROM shared_bucket_members sbm WHERE sbm.bucket_id = b.id)
          ORDER BY b."sortOrder" ASC, b."createdAt" DESC
        `;
        
        // Shared buckets the user owns or participates in
        const sharedBuckets = await sql`
          SELECT b.* FROM buckets b
          JOIN shared_bucket_members sbm ON b.id = sbm.bucket_id
          WHERE sbm.user_id = ${userId}
            AND sbm.status = 'accepted'
            AND b.updatedat >= to_timestamp(${lastSynced} / 1000.0)
          ORDER BY b."sortOrder" ASC, b."createdAt" DESC
        `;
        userBuckets = [...personalBuckets, ...sharedBuckets];
      } else {
        // Personal buckets
        const personalBuckets = await sql`
          SELECT b.* FROM buckets b
          WHERE b.ownerid = ${userId} 
            AND NOT EXISTS (SELECT 1 FROM shared_bucket_members sbm WHERE sbm.bucket_id = b.id)
          ORDER BY b."sortOrder" ASC, b."createdAt" DESC
        `;
        
        // Shared buckets
        const sharedBuckets = await sql`
          SELECT b.* FROM buckets b
          JOIN shared_bucket_members sbm ON b.id = sbm.bucket_id
          WHERE sbm.user_id = ${userId}
            AND sbm.status = 'accepted'
          ORDER BY b."sortOrder" ASC, b."createdAt" DESC
        `;
        userBuckets = [...personalBuckets, ...sharedBuckets];
      }
      
      if (userBuckets.length === 0) return [];

      const bucketIds = userBuckets.map((b: any) => b.id);
      
      // Fetch habit mappings
      const bucketHabits = await sql`
        SELECT bh.*, h.ownerid as habit_owner_id 
        FROM bucket_habits bh
        JOIN habits h ON bh.habit_id = h.id
        WHERE bh.bucket_id = ANY(${bucketIds}::uuid[])
          AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
      `;
      
      // Fetch shared members
      const sharedMembers = await sql`
        SELECT sbm.*, u.username 
        FROM shared_bucket_members sbm
        JOIN users u ON sbm.user_id = u.id
        WHERE sbm.bucket_id = ANY(${bucketIds}::uuid[])
      `;
      
      // Group habits and members by bucket
      const userBucketsWithHabits = userBuckets.map((b: any) => {
        const habits = bucketHabits.filter((bh: any) => bh.bucket_id === b.id);
        const members = sharedMembers.filter((sbm: any) => sbm.bucket_id === b.id);
        
        return normalizeBucket({ 
          ...b, 
          habitIds: habits.map((bh: any) => bh.habit_id),
          sharedMembers: members.map((m: any) => ({
            userId: m.user_id,
            username: m.username,
            status: m.status
          })),
          sharedHabits: habits.map((bh: any) => ({
            habitId: bh.habit_id,
            approvalStatus: bh.approval_status,
            addedBy: bh.added_by,
            habitOwnerId: bh.habit_owner_id
          }))
        });
      });

      return userBucketsWithHabits;
    } catch (error: any) {
      console.error('[API Buckets GET] Error:', error);
      throw createError({
        statusCode: 500,
        statusMessage: error.message || 'Internal Server Error'
      });
    }
  }

  if (event.method === 'POST') {
    try {
      const body = await readBody(event);
      
      const nextSortOrder = 0;

      if (nextSortOrder >= 30) {
        throw createError({ statusCode: 400, statusMessage: 'Bucket limit of 30 reached' });
      }

      const title = body.title;
      const description = body.description || '';
      const color = body.color || '#6366f1';
      const habitIds = body.habitIds && Array.isArray(body.habitIds) ? body.habitIds : [];

      const result = await sql`
        INSERT INTO buckets (id, ownerid, title, description, color, "sortOrder", "createdAt", updatedat)
        VALUES (${body.id ? body.id : sql`DEFAULT`}, ${userId}, ${title}, ${description}, ${color}, ${nextSortOrder}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          "sortOrder" = EXCLUDED."sortOrder",
          updatedat = NOW()
        RETURNING *
      `;

      const newBucket = result[0];
      if (!newBucket) throw createError({ statusCode: 500, statusMessage: 'Failed to create bucket' });

      // Detect and validate habits
      const foreignHabitIds = [];
      const ownHabitIds = [];

      if (habitIds.length > 0) {
        const habitsInfo = await sql`
          SELECT id, ownerid, sharedwith FROM habits WHERE id = ANY(${habitIds}::uuid[])
        `;
        
        for (const hid of habitIds) {
          const habit = habitsInfo.find((h: any) => h.id === hid);
          if (habit && habit.ownerid !== userId) {
            foreignHabitIds.push(habit);
          } else if (habit) {
            ownHabitIds.push(hid);
          }
        }
      }

      const isShared = foreignHabitIds.length > 0;

      // Clear existing mappings before re-inserting (handles updates)
      // Note: For shared buckets, we might want to be more careful, but plan says clear and re-insert/update
      // Actually the plan says: "INSERT INTO bucket_habits ... ON CONFLICT DO UPDATE"
      // But existing code does DELETE then INSERT. Let's adapt.
      
      if (!isShared) {
        await sql`DELETE FROM bucket_habits WHERE bucket_id = ${newBucket.id}::uuid`;
        for (const hid of ownHabitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${newBucket.id}::uuid, ${hid}::uuid, ${userId}, NULL)
          `;
        }
      } else {
        // Shared bucket logic
        const validForeignHabits = [];
        const uniqueForeignOwners = new Set<string>();

        // Check friendships for foreign habits
        const foreignOwnerIds = [...new Set(foreignHabitIds.map(h => h.ownerid))];
        const friendships = await sql`
          SELECT * FROM friendships 
          WHERE status = 'accepted'
            AND (
              (initiatorid = ${userId} AND receiverid = ANY(${foreignOwnerIds}::uuid[]))
              OR (receiverid = ${userId} AND initiatorid = ANY(${foreignOwnerIds}::uuid[]))
            )
        `;

        const removedForeignHabits = [];
        for (const h of foreignHabitIds) {
          const isFriend = friendships.some((f: any) => 
            (f.initiatorid === userId && f.receiverid === h.ownerid) ||
            (f.receiverid === userId && f.initiatorid === h.ownerid)
          );
          const isSharedWithMe = h.sharedwith && h.sharedwith.includes(userId);

          if (isFriend && isSharedWithMe) {
            validForeignHabits.push(h);
            uniqueForeignOwners.add(h.ownerid);
          } else if (isFriend) {
            // Friend, but no longer shared - mark as removed if it exists
            removedForeignHabits.push(h);
          }
        }

        // Insert/Update removed foreign habits
        for (const h of removedForeignHabits) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${newBucket.id}::uuid, ${h.id}::uuid, ${userId}, 'removed')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'removed',
              added_by = EXCLUDED.added_by
          `;
        }


        // Update bucket_habits
        // First, mark habits that are NO LONGER in the list as 'removed'
        await sql`
          UPDATE bucket_habits 
          SET approval_status = 'removed' 
          WHERE bucket_id = ${newBucket.id}::uuid 
            AND habit_id NOT IN (${habitIds.length > 0 ? sql`${habitIds}::uuid[]` : sql`NULL`})
        `;

        // Insert/Update own habits
        for (const hid of ownHabitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${newBucket.id}::uuid, ${hid}::uuid, ${userId}, 'accepted')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'accepted',
              added_by = EXCLUDED.added_by
          `;
        }

        // Insert/Update foreign habits
        for (const h of validForeignHabits) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${newBucket.id}::uuid, ${h.id}::uuid, ${userId}, 'pending')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'pending',
              added_by = EXCLUDED.added_by
          `;
        }

        // Manage shared_bucket_members
        // Add owner
        await sql`
          INSERT INTO shared_bucket_members (bucket_id, user_id, status)
          VALUES (${newBucket.id}::uuid, ${userId}, 'accepted')
          ON CONFLICT (bucket_id, user_id) DO NOTHING
        `;

        // Add foreign owners
        for (const foreignOwnerId of uniqueForeignOwners) {
          await sql`
            INSERT INTO shared_bucket_members (bucket_id, user_id, status)
            VALUES (${newBucket.id}::uuid, ${foreignOwnerId}, 'pending')
            ON CONFLICT (bucket_id, user_id) DO NOTHING
          `;
        }

        // Fire Pusher events to affected friends
        const pusher = usePusher();
        if (pusher) {
          for (const foreignOwnerId of uniqueForeignOwners) {
            await pusher.trigger(`user-${foreignOwnerId}-social`, 'shared-bucket-invite', {
              bucketId: newBucket.id,
              ownerId: userId,
              ownerUsername: (await sql`SELECT username FROM users WHERE id = ${userId}`)[0]?.username
            });
          }
        }
      }

      // Re-evaluate logs for this bucket
      await reevaluateBucketLogs(sql, newBucket.id, userId);
      
      // fetch again to get updated streaks and metadata
      const updatedBucketResult = await sql`SELECT * FROM buckets WHERE id = ${newBucket.id}`;
      const bucket = updatedBucketResult[0];
      if (!bucket) throw createError({ statusCode: 500, statusMessage: 'Bucket not found after update' });


      // Fetch metadata for response
      const habits = await sql`
        SELECT bh.*, h.ownerid as habit_owner_id 
        FROM bucket_habits bh
        JOIN habits h ON bh.habit_id = h.id
        WHERE bh.bucket_id = ${bucket.id}::uuid
          AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
      `;
      
      const members = await sql`
        SELECT sbm.*, u.username 
        FROM shared_bucket_members sbm
        JOIN users u ON sbm.user_id = u.id
        WHERE sbm.bucket_id = ${bucket.id}::uuid
      `;

      const pusher = usePusher();
      if (pusher) {
        await pusher.trigger(`user-${userId}-buckets`, 'sync-settled', { timestamp: Date.now() });
      }

      return normalizeBucket({ 
        ...bucket, 
        habitIds: habits.map((bh: any) => bh.habit_id),
        sharedMembers: members.map((m: any) => ({
          userId: m.user_id,
          username: m.username,
          status: m.status
        })),
        sharedHabits: habits.map((bh: any) => ({
          habitId: bh.habit_id,
          approvalStatus: bh.approval_status,
          addedBy: bh.added_by,
          habitOwnerId: bh.habit_owner_id
        }))
      });
    } catch (error: any) {
      console.error('[API Buckets POST] Error:', error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: error.message || 'Internal Server Error',
        data: error
      });
    }
  }
});

