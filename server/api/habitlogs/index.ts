import { HabitLog } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    const query = getQuery(event);
    const ownerId = query.ownerId ? String(query.ownerId) : userId;

    // For simplicity array containment equivalent in Mongoose is simple equality if checking sharedwith array, currently we just return logs for an ownerid
    const logs = await HabitLog.find({ ownerid: ownerId }).lean();
    return logs.map((l: any) => ({ ...l, id: l._id.toString() }));
  }

  if (event.method === 'POST') {
    const body = await readBody(event);
    const { habitId, date, currentStatus, sharedwith } = body;

    const existingLog = await HabitLog.findOne({ ownerid: userId, habitid: habitId, date });

    if (!existingLog) {
      if (currentStatus === 'completed') return { success: true };
      const newLog = await HabitLog.create({
        habitid: habitId,
        ownerid: userId,
        date,
        status: 'completed',
        sharedwith: sharedwith || []
      });
      return { success: true, id: newLog._id };
    } else {
      if (existingLog.status === 'completed') {
        await HabitLog.deleteOne({ _id: existingLog._id });
      } else {
        existingLog.status = 'completed';
        existingLog.sharedwith = sharedwith || [];
        existingLog.updatedat = new Date();
        await existingLog.save();
      }
      return { success: true };
    }
  }
});
