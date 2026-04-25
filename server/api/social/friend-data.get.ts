import type { IHabit, IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = String(friendId);

  const sharedHabits = await sql`
    SELECT * FROM habits 
    WHERE ownerid = ${fId} AND ${String(userId)} = ANY(sharedwith)
    ORDER BY "sortOrder" ASC
  `;

  const friendHabits = sharedHabits.map((h: any) => ({
    ...h,
    id: h.id
  }));
  
  const habitIds = friendHabits.map((h: any) => h.id);

  let logs: any[] = [];
  if (habitIds.length > 0) {
    const rawLogs = await sql`
      SELECT * FROM habitlogs 
      WHERE ownerid = ${fId} AND habitid = ANY(${habitIds}::uuid[])
    `;
    
    logs = rawLogs.map((l: any) => ({
      ...l,
      id: l.id
    }));
  }

  return {
    habits: friendHabits,
    logs: logs
  };
});
