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
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  const buckets = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (buckets.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
  const bucket = buckets[0] as IBucket;

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    const title = body.title !== undefined ? body.title : bucket.title;
    const description = body.description !== undefined ? body.description : bucket.description;
    const color = body.color !== undefined ? body.color : bucket.color;
    const sortOrder = body.sortOrder !== undefined ? body.sortOrder : bucket.sortOrder;
    const habitIds = body.habitIds && Array.isArray(body.habitIds) ? body.habitIds : null;

    const result = await sql`
      UPDATE buckets
      SET title = ${title}, description = ${description}, color = ${color}, "sortOrder" = ${sortOrder}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    if (habitIds !== null) {
      // Detect and validate habits
      const foreignHabitIds = [];
      const ownHabitIds = [];

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

      const isShared = foreignHabitIds.length > 0;

      if (!isShared) {
        // Check if it was previously shared
        const wasShared = (await sql`SELECT 1 FROM shared_bucket_members WHERE bucket_id = ${id}::uuid AND user_id != ${userId}`).length > 0;
        
        if (wasShared) {
          // If transitioning from shared to personal, we can either keep members or clear them.
          // Plan implies if no foreign habits are left, it's personal.
          // But actually, a shared bucket might just have the owner's habits for a moment.
          // Let's stick to the foreign habits detection.
        }

        await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
        for (const hid of ownHabitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${id}::uuid, ${hid}::uuid, ${userId}, NULL)
          `;
        }
      } else {
        // Shared bucket logic
        const validForeignHabits = [];
        const uniqueForeignOwners = new Set<string>();

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
            removedForeignHabits.push(h);
          }
        }

        // Insert/Update removed foreign habits
        for (const h of removedForeignHabits) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${id}::uuid, ${h.id}::uuid, ${userId}, 'removed')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'removed',
              added_by = EXCLUDED.added_by
          `;
        }


        // Update bucket_habits
        await sql`
          UPDATE bucket_habits 
          SET approval_status = 'removed' 
          WHERE bucket_id = ${id}::uuid 
            AND habit_id NOT IN (${habitIds.length > 0 ? sql`${habitIds}::uuid[]` : sql`NULL`})
        `;

        for (const hid of ownHabitIds) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${id}::uuid, ${hid}::uuid, ${userId}, 'accepted')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'accepted',
              added_by = EXCLUDED.added_by
          `;
        }

        for (const h of validForeignHabits) {
          await sql`
            INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
            VALUES (${id}::uuid, ${h.id}::uuid, ${userId}, 'pending')
            ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
              approval_status = 'pending',
              added_by = EXCLUDED.added_by
          `;
        }

        // Manage shared_bucket_members
        await sql`
          INSERT INTO shared_bucket_members (bucket_id, user_id, status)
          VALUES (${id}::uuid, ${userId}, 'accepted')
          ON CONFLICT (bucket_id, user_id) DO NOTHING
        `;

        for (const foreignOwnerId of uniqueForeignOwners) {
          await sql`
            INSERT INTO shared_bucket_members (bucket_id, user_id, status)
            VALUES (${id}::uuid, ${foreignOwnerId}, 'pending')
            ON CONFLICT (bucket_id, user_id) DO NOTHING
          `;
          
          // Fire invite event if new
          const pusher = usePusher();
          if (pusher) {
            await pusher.trigger(`user-${foreignOwnerId}-social`, 'shared-bucket-invite', {
              bucketId: id,
              ownerId: userId,
              ownerUsername: (await sql`SELECT username FROM users WHERE id = ${userId}`)[0]?.username
            });
          }
        }
      }
      await reevaluateBucketLogs(sql, id as string, userId);
    }

    const updatedBucketResult = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid`;
    const updatedBucket = normalizeBucket(updatedBucketResult[0]);

    // Fetch metadata for response
    const habits = await sql`
      SELECT bh.*, h.ownerid as habit_owner_id 
      FROM bucket_habits bh
      JOIN habits h ON bh.habit_id = h.id
      WHERE bh.bucket_id = ${id}::uuid
        AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
    `;
    
    const members = await sql`
      SELECT sbm.*, u.username 
      FROM shared_bucket_members sbm
      JOIN users u ON sbm.user_id = u.id
      WHERE sbm.bucket_id = ${id}::uuid
    `;

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-updated', { bucketId: id });
    }

    return { 
      ...updatedBucket, 
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
    };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (ownerid, entity_id, entity_type) VALUES (${userId}, ${id}::uuid, 'bucket')`;

    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-buckets`, 'bucket-deleted', { bucketId: id });
    }

    return { success: true };
  }
});
