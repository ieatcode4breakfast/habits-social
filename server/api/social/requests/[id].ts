import { Friendship } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  requireAuth(event);
  const friendshipId = getRouterParam(event, 'id');

  if (!friendshipId) throw createError({ statusCode: 400 });

  if (event.method === 'PUT') {
    // accept
    await Friendship.updateOne({ _id: friendshipId }, { status: 'accepted', updatedat: new Date() });
    return { success: true };
  }

  if (event.method === 'DELETE') {
    // reject or remove
    await Friendship.deleteOne({ _id: friendshipId });
    return { success: true };
  }
});
