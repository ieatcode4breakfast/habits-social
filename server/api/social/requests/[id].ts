import type { IFriendship, IHabit, IHabitLog } from '../../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    await db.collection<IFriendship>('friendships').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'accepted', updatedAt: new Date() } }
    );
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendship = await db.collection<IFriendship>('friendships').findOne({ _id: new ObjectId(id) });
    if (friendship) {
      const u1 = String(friendship.initiatorId);
      const u2 = String(friendship.receiverId);

      await db.collection<IHabit>('habits').updateMany({ ownerid: u1 }, { $pull: { sharedwith: u2 } });
      await db.collection<IHabitLog>('habitlogs').updateMany({ ownerid: u1 }, { $pull: { sharedwith: u2 } });
      
      await db.collection<IHabit>('habits').updateMany({ ownerid: u2 }, { $pull: { sharedwith: u1 } });
      await db.collection<IHabitLog>('habitlogs').updateMany({ ownerid: u2 }, { $pull: { sharedwith: u1 } });

      await db.collection<IFriendship>('friendships').deleteOne({ _id: new ObjectId(id) });
    }
    return { success: true };
  }
});
