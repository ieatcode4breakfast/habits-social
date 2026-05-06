import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { normalizeHabit } from '../_utils/normalize';
import { habitSchema, throwZodError } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;
  const userId = await requireAuth(event);
  const sql = useDB(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);

    let habits;
    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      if (isNaN(lastSynced)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid lastSynced parameter' });
      }
      habits = await sql`
        SELECT id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", "currentStreak", "longestStreak", "streakAnchorDate", user_date, "createdAt", updatedat FROM habits 
        WHERE ownerid = ${userId} 
          AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
        ORDER BY "sortOrder" ASC, "createdAt" DESC
      `;
    } else {
      habits = await sql`
        SELECT id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", "currentStreak", "longestStreak", "streakAnchorDate", user_date, "createdAt", updatedat FROM habits 
        WHERE ownerid = ${userId} 
        ORDER BY "sortOrder" ASC, "createdAt" DESC
      `;
    }
    return { data: habits.map(normalizeHabit) };
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const validation = habitSchema.safeParse(body);
    if (!validation.success) {
      return throwZodError(validation.error);
    }

    const data = validation.data;
    const nextSortOrder = data.sortOrder !== undefined ? data.sortOrder : 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Habit limit of 30 reached' });
    }

    let skipsCount = data.skipsCount ?? 2;
    const skipsPeriod = data.skipsPeriod ?? 'weekly';
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, skipsCount));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, skipsCount));
    }

    const result = await sql`
      INSERT INTO habits (id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", user_date, "createdAt", updatedat)
      VALUES (COALESCE(${data.id}::uuid, gen_random_uuid()), ${userId}, ${data.title}, ${data.description}, ${skipsCount}, ${skipsPeriod}, ${data.color}, ${data.sharedwith}, ${nextSortOrder}, ${data.user_date || null}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        "skipsCount" = EXCLUDED."skipsCount",
        "skipsPeriod" = EXCLUDED."skipsPeriod",
        color = EXCLUDED.color,
        sharedwith = EXCLUDED.sharedwith,
        "sortOrder" = EXCLUDED."sortOrder",
        user_date = EXCLUDED.user_date,
        updatedat = NOW()
      WHERE habits.ownerid = EXCLUDED.ownerid
      RETURNING id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", "currentStreak", "longestStreak", "streakAnchorDate", user_date, "createdAt", updatedat
    `;

    if (!result[0]) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });
    }

    return { data: normalizeHabit(result[0]) };
  }
});
