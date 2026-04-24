import { HabitLog } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
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
    
    const logs = await HabitLog.find(filter).lean();
    
    const results = logs.map((log: any) => ({
      ...log,
      id: log._id.toString()
    }));
    
    return results;
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const habitId = body.habitid;
    
    const existing = await HabitLog.findOne({
      habitid: habitId,
      ownerid: userId,
      date: body.date
    });

    let logResult;
    
    if (existing) {
      existing.status = body.status;
      existing.updatedat = new Date();
      if (body.sharedwith && Array.isArray(body.sharedwith)) {
        existing.sharedwith = body.sharedwith;
      }
      await existing.save();
      logResult = existing._id.toString();
    } else {
      const newLog = await HabitLog.create({
        habitid: habitId,
        ownerid: userId,
        date: body.date,
        status: body.status,
        sharedwith: body.sharedwith && Array.isArray(body.sharedwith) ? body.sharedwith : []
      });
      logResult = newLog._id.toString();
    }

    return { id: logResult, ...body };
  }

  if (event.method === 'DELETE') {
    const query = getQuery(event);
    const habitId = query.habitid;
    
    await HabitLog.deleteOne({
      habitid: habitId,
      ownerid: userId,
      date: String(query.date)
    });
    
    return { success: true };
  }
});
