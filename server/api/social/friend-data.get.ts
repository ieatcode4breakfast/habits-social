import type { IHabit, IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = String(friendId);

  const habits = await sql`
    SELECT * FROM habits 
    WHERE ownerid = ${fId}::text 
    AND (
      sharedwith @> ARRAY[${String(userId)}::text]
    )
    ORDER BY "sortOrder" ASC
  `;

  const friendHabits = habits.map((h: any) => ({
    ...h,
    id: h.id
  }));
  
  const habitIds = habits.map(h => String(h.id));

  if (habitIds.length === 0) {
    return { habits: [], logs: [] };
  }

  const logs = await sql`
    SELECT * FROM habitlogs 
    WHERE date >= TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
    AND habitid = ANY(${habitIds}::text[])
    ORDER BY date DESC
  `;

  return {
    habits: friendHabits,
    logs: logs
  };
});
