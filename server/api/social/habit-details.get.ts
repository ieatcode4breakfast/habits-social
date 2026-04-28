export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { habitId } = getQuery(event);

  if (!habitId) {
    throw createError({ statusCode: 400, statusMessage: 'Habit ID is required' });
  }

  const uIdStr = String(userId);
  const hIdStr = String(habitId);

  // 1. Fetch habit and check ownership/visibility
  const habits = await sql`
    SELECT * FROM habits 
    WHERE id = ${hIdStr}
    AND (ownerid = ${uIdStr} OR ${uIdStr} = ANY(sharedwith))
  `;

  if (habits.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Habit not found or not shared with you' });
  }

  const habit = habits[0];

  // 2. Fetch logs for the last 60 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE habitid = ${hIdStr}
    AND date >= ${cutoffStr}
    ORDER BY date DESC
  `;

  return {
    habit,
    logs
  };
});
