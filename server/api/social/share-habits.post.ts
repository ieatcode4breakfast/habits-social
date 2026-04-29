export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  const { targetUserId, habitIds, user_date } = await readBody(event);
  if (!targetUserId || !Array.isArray(habitIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing targetUserId or habitIds array' });
  }

  const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;

  if (!target) throw createError({ statusCode: 404, statusMessage: 'Target user not found' });

  const targetId = String(targetUserId);

  // 1. Get currently shared habits for this user/target combo
  const currentShared = await sql`
    SELECT id FROM habits 
    WHERE ownerid = ${userId} 
      AND ${targetId} = ANY(sharedwith)
  `;
  const currentSharedIds = currentShared.map(h => String(h.id));
  const newSharedIds = habitIds.map(id => String(id));

  const toAdd = newSharedIds.filter(id => !currentSharedIds.includes(id));
  const toRemove = currentSharedIds.filter(id => !newSharedIds.includes(id));

  const actuallySharedIds: string[] = [];

  // 2. Remove sharing for habits no longer selected
  for (const habitId of toRemove) {
    await sql`
      UPDATE habits 
      SET sharedwith = array_remove(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ${habitId}::uuid
        AND ownerid = ${userId}
    `;
  }

  // 3. Add sharing for newly selected habits
  for (const habitId of toAdd) {
    const result = await sql`
      UPDATE habits 
      SET sharedwith = array_append(sharedwith, ${targetId}),
          updatedat = NOW()
      WHERE id = ${habitId}::uuid
        AND ownerid = ${userId}
        AND NOT (${targetId} = ANY(sharedwith))
      RETURNING id
    `;
    if (result.length > 0) {
      actuallySharedIds.push(habitId);
    }
  }

  // Category 3: Record a single grouped share event for all NEWLY shared habits
  if (actuallySharedIds.length > 0 && user_date) {
    await sql`
      INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
      VALUES (${userId}, ${targetId}, ${actuallySharedIds}::uuid[], ${user_date}, NOW())
    `;
  }

  return { success: true };
});

