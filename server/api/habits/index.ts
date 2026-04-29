import type { IHabit } from '../../models';
import { usePusher } from '../../utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    const userHabits = await sql`SELECT * FROM habits WHERE ownerid = ${userId} ORDER BY "sortOrder" ASC, "createdAt" ASC`;
    return userHabits;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    const countResult = await sql`SELECT COUNT(*) FROM habits WHERE ownerid = ${userId}`;
    const nextSortOrder = parseInt(countResult[0]?.count) || 0;

    const title = body.title;
    const description = body.description || '';
    const frequencyCount = body.frequencyCount || 1;
    const frequencyPeriod = body.frequencyPeriod || 'daily';
    const color = body.color || '#6366f1';
    const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [];
    const user_date = body.user_date || null;

    const result = await sql`
      INSERT INTO habits (ownerid, title, description, "frequencyCount", "frequencyPeriod", color, sharedwith, "sortOrder", user_date, "createdAt", updatedat)
      VALUES (${userId}, ${title}, ${description}, ${frequencyCount}, ${frequencyPeriod}, ${color}, ${sharedwith}, ${nextSortOrder}, ${user_date}, NOW(), NOW())
      RETURNING *
    `;

    const newHabit = result[0];
    if (!newHabit) throw createError({ statusCode: 500, statusMessage: 'Failed to create habit' });

    // Real-time: Notify other devices
    const pusher = usePusher();
    if (pusher) {
      await pusher.trigger(`user-${userId}-habits`, 'habit-updated', { habitId: newHabit!.id });
    }

    return newHabit;
  }
});
