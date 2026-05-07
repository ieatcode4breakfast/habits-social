import { z } from 'zod';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';
import { normalizeBucket } from '~~/server/utils/normalize';
import { bucketUpdateSchema } from '~~/server/utils/validation';

import { reevaluateBucketLogs } from '~~/server/utils/buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }

  const buckets = await sql`SELECT id, owner_id, title, description, color, sort_order, current_streak, longest_streak, streak_anchor_date, created_at, updated_at FROM buckets WHERE id = ${id}::uuid AND owner_id = ${userId}`;
  if ((buckets as any[]).length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  const bucketRaw = (buckets as any[])[0];
  const bucket = normalizeBucket(bucketRaw);

  if (event.method === 'GET') {
    const habits = await sql`
      SELECT habit_id 
      FROM bucket_habits 
      WHERE bucket_id = ${id}::uuid 
        AND (approval_status IS NULL OR approval_status IN ('accepted', 'pending'))
    `;
    return { data: { ...bucket, habitIds: (habits as any[]).map((h: any) => h.habitId) } };
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
      SET title = ${title}, description = ${description}, color = ${color}, sort_order = ${sortOrder}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, owner_id, title, description, color, sort_order, current_streak, longest_streak, streak_anchor_date, created_at, updated_at
    `;

    if ((result as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Not found after update' });
    }

    const updatedBucketRaw = (result as any[])[0];
    const updatedBucket = normalizeBucket(updatedBucketRaw);

    if (data.habitIds !== undefined) {
      const habitIds = data.habitIds as string[];
      
      const foreignHabitRows: any[] = [];
      const ownHabitIds: string[] = [];

      let habitsInfo: any[] = [];
      if (habitIds.length > 0) {
        habitsInfo = await sql`SELECT id, owner_id, shared_with FROM habits WHERE id = ANY(${habitIds}::uuid[])`;
      }

      for (const hid of habitIds) {
        const hRaw = (habitsInfo as any[]).find((h: any) => h.id === hid);
        if (hRaw) {
          const h = normalizeHabit(hRaw);
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
        const friendships = await sql`
          SELECT initiator_id, receiver_id FROM friendships 
          WHERE status = 'accepted'
            AND (
              (initiator_id = ${userId} AND receiver_id = ANY(${foreignOwnerIds}))
              OR (receiver_id = ${userId} AND initiator_id = ANY(${foreignOwnerIds}))
            )
        `;

        for (const h of foreignHabitRows) {
          const isFriend = (friendships as any[]).some((f: any) => 
            (String(f.initiator_id) === String(userId) && String(f.receiver_id) === String(h.ownerId)) ||
            (String(f.receiver_id) === String(userId) && String(f.initiator_id) === String(h.ownerId))
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
        await sql`
          INSERT INTO shared_bucket_members (bucket_id, user_id, status)
          VALUES (${id}::uuid, ${foreignOwnerId}::uuid, 'pending')
          ON CONFLICT (bucket_id, user_id) DO NOTHING
        `;
      }

      // Manage shared_bucket_members - Evictions
      const currentMembers = await sql`
        SELECT user_id FROM shared_bucket_members WHERE bucket_id = ${id}::uuid AND user_id != ${userId}::uuid
      `;

      for (const member of (currentMembers as any[])) {
        const memberId = member.userId;
        const activeHabits = await sql`
          SELECT bh.habit_id 
          FROM bucket_habits bh
          JOIN habits h ON bh.habit_id = h.id
          WHERE bh.bucket_id = ${id}::uuid 
            AND h.owner_id = ${memberId}::uuid
            AND (bh.approval_status IS NULL OR bh.approval_status IN ('accepted', 'pending'))
        `;

        if ((activeHabits as any[]).length === 0) {
          await sql`
            DELETE FROM shared_bucket_members 
            WHERE bucket_id = ${id}::uuid AND user_id = ${memberId}::uuid
          `;
        }
      }

      await reevaluateBucketLogs(sql, id as string, userId);
    }

    const habitsResult = await sql`
      SELECT habit_id 
      FROM bucket_habits 
      WHERE bucket_id = ${id}::uuid 
        AND (approval_status IS NULL OR approval_status IN ('accepted', 'pending'))
    `;
    
    return { data: { ...updatedBucket, habitIds: (habitsResult as any[]).map((h: any) => h.habitId) } };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM shared_bucket_members WHERE bucket_id = ${id}::uuid`;
    await sql`DELETE FROM bucket_habits WHERE bucket_id = ${id}::uuid`;
    await sql`DELETE FROM buckets WHERE id = ${id}::uuid`;
    await sql`INSERT INTO sync_deletions (owner_id, entity_id, entity_type, created_at) VALUES (${userId}, ${id}::uuid, 'bucket', NOW())`;

    return { data: { success: true } };
  }
});
