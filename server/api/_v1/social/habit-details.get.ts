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

  // 2. Fetch logs. Default to last 60 days if no range provided.
  const query = getQuery(event);
  let startDateStr = String(query.startDate || '');
  let endDateStr = String(query.endDate || '');

  if (!startDateStr) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    startDateStr = cutoff.toISOString().slice(0, 10);
  }

  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE habitid = ${hIdStr}
    AND date >= ${startDateStr}
    ${endDateStr ? sql`AND date <= ${endDateStr}` : sql``}
    ORDER BY date DESC
  `;

  return {
    habit,
    logs
  };
});

