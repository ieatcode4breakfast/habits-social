import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeBucket } from '../_utils/normalize';
import { bucketUpdateSchema } from '../_utils/validation';

import { reevaluateBucketLogs } from '../_utils/buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const buckets = await sql`SELECT * FROM buckets WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (buckets.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const bucket = buckets[0];

  if (event.method === 'GET') {
    const habits = await sql`
      SELECT habit_id 
      FROM bucket_habits 
      WHERE bucket_id = ${id}::uuid 
        AND (approval_status IS NULL OR approval_status IN ('accepted', 'pending'))
    `;
    return { data: { ...normalizeBucket(bucket), habitIds: habits.map((h: any) => h.habit_id) } };
  }

  if (event.method === 'PUT') {
    const body = await readBody(event);
    const validation = bucketUpdateSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;
    const title = data.title !== undefined ? data.title : bucket.title;
    const description = data.description !== undefined ? data.description : bucket.description;
    const color = data.color !== undefined ? data.color : bucket.color;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : bucket.sortOrder;

    const result = await sql`
      UPDATE buckets
      SET title = ${title}, description = ${description}, color = ${color}, "sortOrder" = ${sortOrder}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedBucket = result[0];

    if (data.habitIds !== undefined) {
      const habitIds = data.habitIds as string[];
      
      const foreignHabitIds: any[] = [];
      const ownHabitIds: string[] = [];

      let habitsInfo: any[] = [];
      if (habitIds.length > 0) {
        habitsInfo = await sql`SELECT id, ownerid, sharedwith FROM habits WHERE id = ANY(${habitIds}::uuid[])`;
      }

      for (const hid of habitIds) {
        const habit = habitsInfo.find((h: any) => h.id === hid);
        if (habit && habit.ownerid !== userId) {
          foreignHabitIds.push(habit);
        } else if (habit) {
          ownHabitIds.push(hid);
        }
      }

      const validForeignHabits = [];
      const uniqueForeignOwners = new Set<string>();

      if (foreignHabitIds.length > 0) {
        const foreignOwnerIds = [...new Set(foreignHabitIds.map(h => h.ownerid))];
        const friendships = await sql`
          SELECT * FROM friendships 
          WHERE status = 'accepted'
            AND (
              ("initiatorId" = ${userId} AND "receiverId" = ANY(${foreignOwnerIds}::uuid[]))
              OR ("receiverId" = ${userId} AND "initiatorId" = ANY(${foreignOwnerIds}::uuid[]))
            )
        `;

        for (const h of foreignHabitIds) {
          const isFriend = friendships.some((f: any) => 
            (String(f.initiatorId) === String(userId) && String(f.receiverId) === String(h.ownerid)) ||
            (String(f.receiverId) === String(userId) && String(f.initiatorId) === String(h.ownerid))
          );
          const isSharedWithMe = h.sharedwith && h.sharedwith.includes(userId);

          if (isFriend && isSharedWithMe) {
            validForeignHabits.push(h);
            uniqueForeignOwners.add(h.ownerid);
          }
        }
      }

      // Update removed habits
      if (habitIds.length > 0) {
        await sql`
          UPDATE bucket_habits 
          SET approval_status = 'removed' 
          WHERE bucket_id = ${id}::uuid 
            AND habit_id != ALL(${habitIds}::uuid[])
        `;
      } else {
        await sql`
          UPDATE bucket_habits 
          SET approval_status = 'removed' 
          WHERE bucket_id = ${id}::uuid
        `;
      }

      // Add own habits
      for (const hid of ownHabitIds) {
        await sql`
          INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
          VALUES (${id}::uuid, ${hid}::uuid, ${userId}, 'accepted')
          ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
            approval_status = 'accepted',
            added_by = EXCLUDED.added_by
        `;
      }

      // Add foreign habits
      for (const h of validForeignHabits) {
        await sql`
          INSERT INTO bucket_habits (bucket_id, habit_id, added_by, approval_status)
          VALUES (${id}::uuid, ${h.id}::uuid, ${userId}, 'pending')
          ON CONFLICT (bucket_id, habit_id) DO UPDATE SET 
            approval_status = CASE 
              WHEN bucket_habits.approval_status = 'accepted' THEN 'accepted' 
              ELSE 'pending' 
            END,
            added_by = EXCLUDED.added_by
        `;
      }

      // Manage shared_bucket_members - Invites
      for (const foreignOwnerId of uniqueForeignOwners) {
        const res = await sql`
          INSERT INTO shared_bucket_members (bucket_id, user_id, status)
          VALUES (${id}::uuid, ${foreignOwnerId}::uuid, 'pending')
          ON CONFLICT (bucket_id, user_id) DO NOTHING
          RETURNING *
        `;
        

      }

      // Manage shared_bucket_members - Evictions
      const currentMembers = await sql`
        SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${id}::uuid AND user_id != ${userId}::uuid
      `;

      for (const member of currentMembers) {
        const memberId = member.user_id;
        const activeHabits = await sql`
          SELECT bh.habit_id 
          FROM bucket_habits bh
          JOIN habits h ON bh.habit_id = h.id
          WHERE bh.bucket_id = ${id}::uuid 
            AND h.ownerid = ${memberId}::uuid
            AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
        `;

        if (activeHabits.length === 0) {
          await sql`
            DELETE FROM shared_bucket_members 
            WHERE bucket_id = ${id}::uuid AND user_id = ${memberId}::uuid
          `;
        }
      }

      await reevaluateBucketLogs(sql, id as string, userId);
    }

    const habits = await sql`
      SELECT habit_id 
      FROM bucket_habits 
      WHERE bucket_id = ${id}::uuid 
        AND (approval_status IS NULL OR approval_status IN ('accepted', 'pending'))
    `;
    
    return { data: { ...normalizeBucket(updatedBucket), habitIds: habits.map((h: any) => h.habit_id) } };
  }

  if (event.method === 'DELETE') {
    const buckets = await sql`SELECT bucket_id FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
    
    await sql`DELETE FROM shared_bucket_members WHERE bucket_id = ${id}::uuid`;
    await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (ownerid, entity_id, entity_type, created_at) VALUES (${userId}, ${id}::uuid, 'bucket', NOW())`;

    return { data: { success: true } };
  }
});
