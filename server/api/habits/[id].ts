import { Habit } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  const habit = await Habit.findOne({ _id: id, ownerid: userId });
  if (!habit) throw createError({ statusCode: 404, statusMessage: 'Not found' });

  if (event.method === 'PUT') {
    const body = await readBody(event);
    
    habit.title = body.title !== undefined ? body.title : habit.title;
    habit.description = body.description !== undefined ? body.description : habit.description;
    habit.frequencyCount = body.frequencyCount !== undefined ? body.frequencyCount : habit.frequencyCount;
    habit.frequencyPeriod = body.frequencyPeriod !== undefined ? body.frequencyPeriod : habit.frequencyPeriod;
    habit.color = body.color !== undefined ? body.color : habit.color;
    
    if (body.sharedwith && Array.isArray(body.sharedwith)) {
      habit.sharedwith = body.sharedwith;
    }
    
    habit.updatedat = new Date();
    await habit.save();

    return { success: true };
  }

  if (event.method === 'DELETE') {
    await Habit.deleteOne({ _id: id });
    return { success: true };
  }
});
