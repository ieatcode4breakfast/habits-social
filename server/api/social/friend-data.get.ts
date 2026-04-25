import type { IHabit, IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { friendId } = getQuery(event);
  const fId = String(friendId);

  // Fetch habits owned by friend that are shared with the current user
  const habits = await sql`
    SELECT * FROM habits 
    WHERE ownerid = ${fId}
    AND ${String(userId)} = ANY(sharedwith)
    ORDER BY "sortOrder" ASC
  `;

  if (habits.length === 0) {
    return { habits: [], logs: [] };
  }

  const habitIdSet = new Set(habits.map((h: any) => String(h.id)));

  // Fetch logs for this friend's habits in the last 30 days
  // Query by ownerid to avoid array parameter issues, filter in JS
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const allLogs = await sql`
    SELECT * FROM habitlogs 
    WHERE ownerid = ${fId}
    AND date >= ${cutoffStr}
    ORDER BY date DESC
  `;

  // Filter logs to only those belonging to the shared habits
  const logs = allLogs.filter((l: any) => habitIdSet.has(String(l.habitid)));

  return {
    habits: habits,
    logs: logs
  };
});
