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
  const actuallySharedIds: string[] = [];

  // Update each habit individually to avoid Neon HTTP driver array param issues
  for (const rawId of habitIds) {
    const habitId = String(rawId);
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

  // Category 3: Record a single grouped share event for all newly shared habits
  if (actuallySharedIds.length > 0 && user_date) {
    await sql`
      INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
      VALUES (${userId}, ${targetId}, ${actuallySharedIds}::uuid[], ${user_date}, NOW())
    `;
  }

  return { success: true };
});

