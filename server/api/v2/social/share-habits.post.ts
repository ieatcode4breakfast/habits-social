import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { shareHabitsSchema } from '../_utils/validation';
import { markBucketHabitsRemoved } from '../_utils/shared-buckets';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = shareHabitsSchema.safeParse(body);
  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
  }

  const { targetUserId, habitIds, user_date } = validation.data;

  const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Target user not found' });
  }

  const targetId = String(targetUserId);

  // Get currently shared habits for this user/target combo
  const currentShared = await sql`
    SELECT id FROM habits 
    WHERE ownerid = ${userId} 
      AND ${targetId} = ANY(sharedwith)
  `;
  const currentSharedIds = currentShared.map((h: any) => String(h.id));
  const newSharedIds = habitIds.map((id: string) => String(id));

  const toAdd = newSharedIds.filter((id: string) => !currentSharedIds.includes(id));
  const toRemove = currentSharedIds.filter((id: string) => !newSharedIds.includes(id));

  const actuallySharedIds: string[] = [];

  // Remove sharing for habits no longer selected
  if (toRemove.length > 0) {
    await sql`
      UPDATE habits
      SET sharedwith = array_remove(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ANY(${toRemove}::uuid[])
        AND ownerid = ${userId}
    `;
  }

  if (toRemove.length > 0) {
    await markBucketHabitsRemoved(sql, toRemove, [targetId]);
  }

  // Add sharing for newly selected habits
  if (toAdd.length > 0) {
    const result = await sql`
      UPDATE habits
      SET sharedwith = array_append(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ANY(${toAdd}::uuid[])
        AND ownerid = ${userId}
        AND NOT (${targetId} = ANY(sharedwith))
      RETURNING id
    `;
    actuallySharedIds.push(...result.map(r => r.id));
  }

  // Record share event for all newly shared habits
  if (actuallySharedIds.length > 0 && user_date) {
    await sql`
      INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
      VALUES (${userId}, ${targetId}, ${actuallySharedIds}::uuid[], ${user_date}, NOW())
    `;
  }

  return { data: { success: true } };
});
