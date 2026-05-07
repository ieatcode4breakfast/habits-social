import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { normalizeLog } from '../../utils/normalize';
import { bucketLogSchema } from '../../utils/validation';

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
        SELECT id, bucket_id, owner_id, date, status, streak_count, broken_streak_count, updated_at FROM bucket_logs 
        WHERE owner_id = ${userId} 
          AND updated_at >= to_timestamp(${lastSynced} / 1000.0)
      `;
    } else if (query.startDate && query.endDate) {
      logs = await sql`
        SELECT id, bucket_id, owner_id, date, status, streak_count, broken_streak_count, updated_at FROM bucket_logs 
        WHERE owner_id = ${userId} 
          AND date >= ${String(query.startDate)} 
          AND date <= ${String(query.endDate)}
      `;
    } else {
      logs = await sql`SELECT id, bucket_id, owner_id, date, status, streak_count, broken_streak_count, updated_at FROM bucket_logs WHERE owner_id = ${userId}`;
    }

    return { data: (logs as any[]).map(normalizeLog) };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = bucketLogSchema.safeParse(body);
    if (!validation.success) {
      throw createError({ statusCode: 400, statusMessage: 'Validation Failed', data: validation.error.flatten() });
    }

    const data = validation.data;

    // Validate bucket exists and is owned by user
    const bucketCheck = await sql`SELECT id FROM buckets WHERE id = ${data.bucketId}::uuid AND owner_id = ${userId}`;
    if ((bucketCheck as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Bucket not found' });
    }

    const logId = data.id || `${data.bucketId}_${data.date}`;

    const result = await sql`
      INSERT INTO bucket_logs (id, bucket_id, owner_id, date, status, streak_count, broken_streak_count, updated_at)
      VALUES (${logId}, ${data.bucketId}::uuid, ${userId}, ${data.date}, ${data.status}, ${data.streakCount ?? 0}, ${data.brokenStreakCount ?? 0}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        streak_count = EXCLUDED.streak_count,
        broken_streak_count = EXCLUDED.broken_streak_count,
        updated_at = NOW()
      WHERE bucket_logs.owner_id = EXCLUDED.owner_id
      RETURNING id, bucket_id, owner_id, date, status, streak_count, broken_streak_count, updated_at
    `;

    return { data: normalizeLog((result as any[])[0]) };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const bucketId = String(query.bucketId || '');
    const dateStr = String(query.date || '');

    if (!bucketId || !dateStr) {
      throw createError({ statusCode: 400, statusMessage: 'bucketId and date are required' });
    }

    // Bucket logs are synthesized server-side based on habit logs.
    // We treat explicit client deletions as a no-op to protect server derived data.

    return { data: { success: true } };
  }
});
