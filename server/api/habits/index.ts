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
    const userHabits = await sql`SELECT * FROM habits WHERE ownerid = ${userId} ORDER BY "sortOrder" ASC, "createdAt" ASC`;
    return userHabits.map(normalizeHabit);
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    const countResult = await sql`SELECT COUNT(*) FROM habits WHERE ownerid = ${userId}`;
    const nextSortOrder = parseInt(countResult[0]?.count) || 0;

    if (nextSortOrder >= 30) {
      throw createError({ statusCode: 400, statusMessage: 'Habit limit of 30 reached' });
    }

    const title = body.title;
    const description = body.description || '';
    const frequencyCount = body.frequencyCount || 1;
    const frequencyPeriod = body.frequencyPeriod || 'daily';
    const color = body.color || '#6366f1';
    const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
    const user_date = body.user_date || null;

    const result = await sql`
      INSERT INTO habits (id, ownerid, title, description, "frequencyCount", "frequencyPeriod", color, sharedwith, "sortOrder", user_date, "createdAt", updatedat)
      VALUES (${body.id ? body.id : sql`DEFAULT`}, ${userId}, ${title}, ${description}, ${frequencyCount}, ${frequencyPeriod}, ${color}, ${sharedwith}, ${nextSortOrder}, ${user_date}, NOW(), NOW())
      RETURNING *
    `;

    const newHabit = result[0];
    if (!newHabit) throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-updated', { habitId: newHabit!.id });
    }

    return normalizeHabit(newHabit);
  }
});

