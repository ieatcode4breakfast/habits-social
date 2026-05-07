import { z } from 'zod';
import { useDB as _useDB } from '../../utils/db';
import { requireAuth as _requireAuth } from '../../utils/auth';
import { normalizeHabit } from '../../utils/normalize';
import { habitSchema, throwZodError } from '../../utils/validation';

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
        SELECT id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at FROM habits 
        WHERE owner_id = ${userId} 
          AND updated_at >= to_timestamp(${lastSynced} / 1000.0)
        ORDER BY sort_order ASC, created_at DESC
      `;
    } else {
      habits = await sql`
        SELECT id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at FROM habits 
        WHERE owner_id = ${userId} 
        ORDER BY sort_order ASC, created_at DESC
      `;
    }
    return { data: (habits as any[]).map(normalizeHabit) };
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
      INSERT INTO habits (id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, user_date, created_at, updated_at)
      VALUES (COALESCE(${data.id}::uuid, gen_random_uuid()), ${userId}, ${data.title}, ${data.description}, ${skipsCount}, ${skipsPeriod}, ${data.color}, ${data.sharedWith}, ${nextSortOrder}, ${data.userDate || null}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        skips_count = EXCLUDED.skips_count,
        skips_period = EXCLUDED.skips_period,
        color = EXCLUDED.color,
        shared_with = EXCLUDED.shared_with,
        sort_order = EXCLUDED.sort_order,
        user_date = EXCLUDED.user_date,
        updated_at = NOW()
      WHERE habits.owner_id = EXCLUDED.owner_id
      RETURNING id, owner_id, title, description, skips_count, skips_period, color, shared_with, sort_order, current_streak, longest_streak, streak_anchor_date, user_date, created_at, updated_at
    `;

    if (!(result as any[])[0]) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });
    }

    return { data: normalizeHabit((result as any[])[0]) };
  }
});
