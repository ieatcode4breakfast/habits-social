import type { IHabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const query = getQuery(event);
    const filter: any = { ownerid: userId };
    
    if (query.startDate && query.endDate) {
      filter.date = {
        $gte: String(query.startDate),
        $lte: String(query.endDate)
      };
    }
    
    const logs = await db.collection<IHabitLog>('habitlogs').find(filter).toArray();
    
    const results = logs.map((log: any) => ({
      ...log,
      id: log._id.toString()
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habitId = String(body.habitid);
    const dateStr = String(body.date);
    
    const existing = await db.collection<IHabitLog>('habitlogs').findOne({
      habitid: habitId,
      ownerid: userId,
      date: dateStr
    });

    if (existing) {
      const updateData: any = {
        status: String(body.status),
        updatedat: new Date()
      };
      if (body.sharedwith && Array.isArray(body.sharedwith)) {
        updateData.sharedwith = body.sharedwith;
      }
      
      const result = await db.collection<IHabitLog>('habitlogs').findOneAndUpdate(
        { _id: existing._id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      
      return { 
        ...result,
        id: result!._id!.toString() 
      };
    } else {
      const newLog = {
        habitid: habitId,
        ownerid: userId,
        date: dateStr,
        status: String(body.status),
        sharedwith: body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : [],
        updatedat: new Date()
      };
      
      const result = await db.collection<IHabitLog>('habitlogs').insertOne(newLog);
      
      return { 
        ...newLog,
        _id: result.insertedId,
        id: result.insertedId.toString() 
      };
    }
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = String(query.habitid);
    
    await db.collection<IHabitLog>('habitlogs').deleteOne({
      habitid: habitId,
      ownerid: userId,
      date: String(query.date)
    });
    
    return { success: true };
  }
});
