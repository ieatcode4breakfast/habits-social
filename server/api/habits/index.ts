import { IHabit } from '../../models';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const userHabits = await db.collection<IHabit>('habits')
      .find({ ownerid: userId })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray();
    
    const results = userHabits.map((habit: any) => ({
      ...habit,
      id: habit._id.toString()
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    
    const count = await db.collection<IHabit>('habits').countDocuments({ ownerid: userId });
    const nextSortOrder = count || 0;

    const newHabit = {
      ownerid: userId,
      title: body.title,
      description: body.description || '',
      frequencyCount: body.frequencyCount || 1,
      frequencyPeriod: body.frequencyPeriod || 'daily',
      color: body.color || '#6366f1',
      sharedwith: body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [],
      sortOrder: nextSortOrder,
      createdAt: new Date(),
      updatedat: new Date()
    };

    const result = await db.collection<IHabit>('habits').insertOne(newHabit);

    return { 
      ...newHabit, 
      _id: result.insertedId,
      id: result.insertedId.toString() 
    };
  }
});
