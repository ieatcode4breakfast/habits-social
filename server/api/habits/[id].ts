import type { IHabit } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' });

  const habits = await sql`SELECT * FROM habits WHERE id = ${id}::uuid AND ownerid = ${userId}`;
  if (habits.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found' });
  const habit = habits[0] as IHabit;

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    const title = body.title !== undefined ? body.title : habit.title;
    const description = body.description !== undefined ? body.description : habit.description;
    const frequencyCount = body.frequencyCount !== undefined ? body.frequencyCount : habit.frequencyCount;
    const frequencyPeriod = body.frequencyPeriod !== undefined ? body.frequencyPeriod : habit.frequencyPeriod;
    const color = body.color !== undefined ? body.color : habit.color;
    const sharedwith = body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : habit.sharedwith;

    const result = await sql`
      UPDATE habits
      SET title = ${title}, description = ${description}, "frequencyCount" = ${frequencyCount}, "frequencyPeriod" = ${frequencyPeriod}, color = ${color}, sharedwith = ${sharedwith}, updatedat = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `;

    if (result.length === 0) throw createError({ statusCode: 404, statusMessage: 'Not found after update' });

    const updatedHabit = result[0];
    return { 
      ...updatedHabit,
      _id: updatedHabit.id
    };
  }

  if (event.method === 'DELETE') {
    await sql`DELETE FROM habits WHERE id = ${id}::uuid`;
    return { success: true };
  }
});
