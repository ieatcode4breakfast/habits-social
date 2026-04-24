import { Friendship, Habit } from '../../../models';
import { connectDB } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    await Friendship.updateOne({ _id: id }, { status: 'accepted', updatedat: new Date() });
    return { success: true };
  }

  if (event.method === 'DELETE') {
    const friendship = await Friendship.findById(id);
    if (friendship) {
      const [u1, u2] = friendship.participants;
      // Remove each user from the other's shared habits
      await Habit.updateMany({ ownerid: u1 }, { $pull: { sharedwith: u2 } });
      await Habit.updateMany({ ownerid: u2 }, { $pull: { sharedwith: u1 } });
      await Friendship.deleteOne({ _id: id });
    }
    return { success: true };
  }
});
