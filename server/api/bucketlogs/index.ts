export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);
    
    let logs;
    if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT * FROM bucketlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT * FROM bucketlogs WHERE ownerid = ${userId}`;
    }
    
    return logs;
  }
});
