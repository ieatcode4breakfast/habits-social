import type { IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);
    
    let logs;
    if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT * FROM habitlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT * FROM habitlogs WHERE ownerid = ${userId}`;
    }
    
    return logs;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habitId = String(body.habitid);
    const dateStr = String(body.date);
    const status = String(body.status);

    const existing = await sql`
      SELECT * FROM habitlogs 
      WHERE habitid = ${habitId} AND ownerid = ${userId} AND date = ${dateStr}
    `;

    if (existing.length > 0) {
      const existingLog = existing[0]!;
      const newSharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : existingLog.sharedwith;
      
      const result = await sql`
        UPDATE habitlogs
        SET status = ${status}, sharedwith = ${newSharedwith}, updatedat = NOW()
        WHERE id = ${existingLog.id}
        RETURNING *
      `;
      
      return result[0];
    } else {
      const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
      const result = await sql`
        INSERT INTO habitlogs (habitid, ownerid, date, status, sharedwith, updatedat)
        VALUES (${habitId}, ${userId}, ${dateStr}, ${status}, ${sharedwith}, NOW())
        RETURNING *
      `;
      
      return result[0];
    }
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = String(query.habitid);
    const dateStr = String(query.date);
    
    await sql`
      DELETE FROM habitlogs 
      WHERE habitid = ${habitId} AND ownerid = ${userId} AND date = ${dateStr}
    `;
    
    return { success: true };
  }
});
