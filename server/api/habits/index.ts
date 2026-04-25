import type { IHabit } from '../../models';

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

    const result = await sql`
      INSERT INTO habits (ownerid, title, description, "frequencyCount", "frequencyPeriod", color, sharedwith, "sortOrder", "createdAt", updatedat)
      VALUES (${userId}, ${title}, ${description}, ${frequencyCount}, ${frequencyPeriod}, ${color}, ${sharedwith}, ${nextSortOrder}, NOW(), NOW())
      RETURNING *
    `;

    const newHabit = result[0];

    return newHabit;
  }
});
