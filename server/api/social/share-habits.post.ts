import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { shareHabitsSchema } from '../../utils/validation';
import { markBucketHabitsRemoved } from '../../utils/shared-buckets';

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

  const { targetUserId, habitIds, userDate } = validation.data;

  const targetId = String(targetUserId);
  
  // Verify accepted friendship exists
  const friendship = await sql`
    SELECT 1 FROM friendships 
    WHERE status = 'accepted'
      AND (
        (initiator_id = ${userId} AND receiver_id = ${targetId})
        OR 
        (initiator_id = ${targetId} AND receiver_id = ${userId})
      )
  `;

  if ((friendship as any[]).length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You can only share habits with friends' });
  }

  // Get currently shared habits for this user/target combo
  const currentShared = await sql`
    SELECT id FROM habits 
    WHERE owner_id = ${userId} 
      AND ${targetId}::text = ANY(shared_with)
  `;
  const currentSharedIds = (currentShared as any[]).map((h: any) => String(h.id));
  const newSharedIds = habitIds.map((id: string) => String(id));

  const toAdd = newSharedIds.filter((id: string) => !currentSharedIds.includes(id));
  const toRemove = currentSharedIds.filter((id: string) => !newSharedIds.includes(id));

  const actuallySharedIds: string[] = [];

  // Remove sharing for habits no longer selected
  if (toRemove.length > 0) {
    await sql`
      UPDATE habits
      SET shared_with = array_remove(shared_with, ${targetId}),
          updated_at = NOW()
      WHERE id = ANY(${toRemove}::uuid[])
        AND owner_id = ${userId}
    `;
  }

  if (toRemove.length > 0) {
    await markBucketHabitsRemoved(sql, toRemove, [targetId]);
  }

  // Add sharing for newly selected habits
  if (toAdd.length > 0) {
    const result = await sql`
      UPDATE habits
      SET shared_with = array_append(shared_with, ${targetId}),
          updated_at = NOW()
      WHERE id = ANY(${toAdd}::uuid[])
        AND owner_id = ${userId}
        AND NOT (${targetId} = ANY(shared_with))
      RETURNING id
    `;
    actuallySharedIds.push(...(result as any[]).map((r: any) => r.id));
  }

  // Record share event for all newly shared habits
  if (actuallySharedIds.length > 0 && userDate) {
    await sql`
      INSERT INTO share_events (owner_id, recipient_id, habit_ids, user_date, created_at)
      VALUES (${userId}, ${targetId}, ${actuallySharedIds}::uuid[], ${userDate}, NOW())
    `;
  }

  return { data: { success: true } };
});
