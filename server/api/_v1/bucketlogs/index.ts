import { format } from 'date-fns';

const normalizeLog = (log: any) => {
  if (!log) return log;
  const normalized = { ...log };
  if (normalized.date) {
    normalized.date = format(new Date(normalized.date), 'yyyy-MM-dd');
  }
  return normalized;
};

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);
    
    let logs;
    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      logs = await sql`
        SELECT * FROM bucketlogs 
        WHERE ownerid = ${userId} 
          AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
      `;
    } else if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT * FROM bucketlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT * FROM bucketlogs WHERE ownerid = ${userId}`;
    }
    
    return logs.map(normalizeLog);
  }
});

