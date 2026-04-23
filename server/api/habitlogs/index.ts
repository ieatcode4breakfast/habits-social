import { HabitLog } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    const query = getQuery(event);
    const filter: any = { ownerid: userId };
    if (query.startDate && query.endDate) {
      filter.date = { $gte: String(query.startDate), $lte: String(query.endDate) };
    }
    const logs = await HabitLog.find(filter).lean();
    return logs.map((l: any) => ({ ...l, id: l._id.toString(), habitid: l.habitid.toString() }));
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const existing = await HabitLog.findOne({ habitid: body.habitid, ownerid: userId, date: body.date });
    if (existing) {
      existing.status = body.status;
      if (body.sharedwith) existing.sharedwith = body.sharedwith;
      existing.updatedat = new Date();
      await existing.save();
      return { ...existing.toObject(), id: existing._id.toString(), habitid: existing.habitid.toString() };
    }
    const log = await HabitLog.create({
      habitid: body.habitid,
      ownerid: userId,
      date: body.date,
      status: body.status,
      sharedwith: body.sharedwith || []
    });
    return { ...log.toObject(), id: log._id.toString(), habitid: log.habitid.toString() };
  }
});
