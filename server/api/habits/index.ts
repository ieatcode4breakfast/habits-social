import { format } from 'date-fns';
import type { IHabit } from '../../models';
import { usePusher } from '../../utils/pusher';

const normalizeHabit = (h: any) => {
  if (!h) return h;
  const normalized = { ...h };
  if (normalized.streakAnchorDate) {
    normalized.streakAnchorDate = format(new Date(normalized.streakAnchorDate), 'yyyy-MM-dd');
  }
  return normalized;
};

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const query = getQuery(event);
    let userHabits;

    if (query.lastSynced) {
      const lastSynced = Number(query.lastSynced);
      userHabits = await sql`
        SELECT * FROM habits 
        WHERE ownerid = ${userId} 
          AND updatedat >= to_timestamp(${lastSynced} / 1000.0)
        ORDER BY "sortOrder" ASC, "createdAt" DESC
      `;
    } else {
      userHabits = await sql`
        SELECT * FROM habits 
        WHERE ownerid = ${userId} 
        ORDER BY "sortOrder" ASC, "createdAt" DESC
      `;
    }
    return userHabits.map(normalizeHabit);
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    const nextSortOrder = 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Habit limit of 30 reached' });
    }

    const title = body.title;
    const description = body.description || '';
    const skipsPeriod = body.skipsPeriod || 'weekly';
    const rawSkipsCount = body.skipsCount !== undefined ? body.skipsCount : 2;
    
    let skipsCount = rawSkipsCount;
    if (skipsPeriod === 'none') {
      skipsCount = 0;
    } else if (skipsPeriod === 'weekly') {
      skipsCount = Math.max(0, Math.min(6, rawSkipsCount));
    } else if (skipsPeriod === 'monthly') {
      skipsCount = Math.max(0, Math.min(28, rawSkipsCount));
    }
    const color = body.color || '#6366f1';
    const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
    const user_date = body.user_date || null;

    const result = await sql`
      INSERT INTO habits (id, ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", user_date, "createdAt", updatedat)
      VALUES (${body.id ? body.id : sql`DEFAULT`}, ${userId}, ${title}, ${description}, ${skipsCount}, ${skipsPeriod}, ${color}, ${sharedwith}, ${nextSortOrder}, ${user_date}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        "skipsCount" = EXCLUDED."skipsCount",
        "skipsPeriod" = EXCLUDED."skipsPeriod",
        color = EXCLUDED.color,
        sharedwith = EXCLUDED.sharedwith,
        "sortOrder" = EXCLUDED."sortOrder",
        updatedat = NOW()
      RETURNING *
    `;

    const newHabit = result[0];
    if (!newHabit) throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'sync-settled', { timestamp: Date.now() });
    }

    return normalizeHabit(newHabit);
  }
});

