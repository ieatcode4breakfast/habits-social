import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeLog } from '../_utils/normalize';
import { bucketLogSchema } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    let logs;
    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      logs = await sql`
        SELECT id, bucketid, ownerid, date, status, "streakCount", "brokenStreakCount", updatedat FROM bucketlogs 
        WHERE ownerid = ${userId} 
          AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
      `;
    } else if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT id, bucketid, ownerid, date, status, "streakCount", "brokenStreakCount", updatedat FROM bucketlogs 
        WHERE ownerid = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT id, bucketid, ownerid, date, status, "streakCount", "brokenStreakCount", updatedat FROM bucketlogs WHERE ownerid = ${userId}`;
    }

    return { data: logs.map(normalizeLog) };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = bucketLogSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    // Validate bucket exists and is owned by user
    const bucketCheck = await sql`SELECT id FROM buckets WHERE id = ${data.bucketid}::uuid AND ownerid = ${userId}`;
    if (bucketCheck.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Bucket not found' });
    }

    const logId = data.id || `${data.bucketid}_${data.date}`;

    const result = await sql`
      INSERT INTO bucketlogs (id, bucketid, ownerid, date, status, "streakCount", "brokenStreakCount", updatedat)
      VALUES (${logId}, ${data.bucketid}::uuid, ${userId}, ${data.date}, ${data.status}, ${data.streakCount ?? 0}, ${data.brokenStreakCount ?? 0}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        "streakCount" = EXCLUDED."streakCount",
        "brokenStreakCount" = EXCLUDED."brokenStreakCount",
        updatedat = NOW()
      WHERE bucketlogs.ownerid = EXCLUDED.ownerid
      RETURNING id, bucketid, ownerid, date, status, "streakCount", "brokenStreakCount", updatedat
    `;

    return { data: normalizeLog(result[0]) };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const bucketId = String(query.bucketid || '');
    const dateStr = String(query.date || '');

    if (!bucketId || !dateStr) {
      throw createError({ statusCode: 400, statusMessage: 'bucketid and date are required' });
    }

    // Bucket logs are synthesized server-side based on habit logs.
    // We treat explicit client deletions as a no-op to protect server derived data.

    return { data: { success: true } };
  }
});
