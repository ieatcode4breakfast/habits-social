import { habitLogs, habitLogShares } from '../../models';
import { eq, and, gte, lte } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const query = getQuery(event);
    let conditions = [eq(habitLogs.ownerId, userId)];
    
    if (query.startDate && query.endDate) {
      conditions.push(gte(habitLogs.date, String(query.startDate)));
      conditions.push(lte(habitLogs.date, String(query.endDate)));
    }
    
    const logs = await db.select().from(habitLogs).where(and(...conditions));
    
    // Fetch shares for logs if needed (optional depending on frontend)
    const results = await Promise.all(logs.map(async (log: any) => {
      const shares = await db.select().from(habitLogShares).where(eq(habitLogShares.habitLogId, log.id));
      return {
        ...log,
        sharedwith: shares.map((s: any) => s.userId)
      };
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habitId = Number(body.habitid);
    
    const existing = await db.select().from(habitLogs).where(and(
      eq(habitLogs.habitId, habitId),
      eq(habitLogs.ownerId, userId),
      eq(habitLogs.date, body.date)
    )).get();

    const logResult = await db.transaction(async (tx: any) => {
      let logId: number;
      
      if (existing) {
        await tx.update(habitLogs).set({
          status: body.status,
          updatedAt: new Date(),
        }).where(eq(habitLogs.id, existing.id));
        logId = existing.id;
      } else {
        const created = await tx.insert(habitLogs).values({
          habitId: habitId,
          ownerId: userId,
          date: body.date,
          status: body.status,
        }).returning().get();
        logId = created.id;
      }

      if (body.sharedwith && Array.isArray(body.sharedwith)) {
        await tx.delete(habitLogShares).where(eq(habitLogShares.habitLogId, logId));
        for (const sharedUserId of body.sharedwith) {
          await tx.insert(habitLogShares).values({
            habitLogId: logId,
            userId: Number(sharedUserId),
          });
        }
      }
      
      return logId;
    });

    return { id: logResult, ...body };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = Number(query.habitid);
    
    const target = await db.select().from(habitLogs).where(and(
      eq(habitLogs.habitId, habitId),
      eq(habitLogs.ownerId, userId),
      eq(habitLogs.date, String(query.date))
    )).get();

    if (target) {
      await db.transaction(async (tx: any) => {
        await tx.delete(habitLogShares).where(eq(habitLogShares.habitLogId, target.id));
        await tx.delete(habitLogs).where(eq(habitLogs.id, target.id));
      });
    }
    
    return { success: true };
  }
});
