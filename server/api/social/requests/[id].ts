import { Friendship, Habit, HabitLog } from '../../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  await requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    await Friendship.findByIdAndUpdate(id, {
      status: 'accepted',
      updatedAt: new Date()
    });
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendship = await Friendship.findById(id);
    if (friendship) {
      const u1 = friendship.initiatorId;
      const u2 = friendship.receiverId;

      await Habit.updateMany({ ownerid: u1 }, { $pull: { sharedwith: u2 } });
      await HabitLog.updateMany({ ownerid: u1 }, { $pull: { sharedwith: u2 } });
      
      await Habit.updateMany({ ownerid: u2 }, { $pull: { sharedwith: u1 } });
      await HabitLog.updateMany({ ownerid: u2 }, { $pull: { sharedwith: u1 } });

      await Friendship.deleteOne({ _id: id });
    }
    return { success: true };
  }
});
