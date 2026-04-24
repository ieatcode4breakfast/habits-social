import { Habit } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const userHabits = await Habit.find({ ownerid: userId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    
    const results = userHabits.map((habit: any) => ({
      ...habit,
      id: habit._id.toString()
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    const count = await Habit.countDocuments({ ownerid: userId });
    const nextSortOrder = count || 0;

    const newHabit = await Habit.create({
      ownerid: userId,
      title: body.title,
      description: body.description || '',
      frequencyCount: body.frequencyCount || 1,
      frequencyPeriod: body.frequencyPeriod || 'daily',
      color: body.color || '#6366f1',
      sharedwith: body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [],
      sortOrder: nextSortOrder,
    });

    return { 
      ...newHabit.toObject(), 
      id: newHabit._id.toString() 
    };
  }
});
