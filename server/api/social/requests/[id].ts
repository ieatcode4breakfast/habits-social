import { Friendship } from '../../../models';
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
    await Friendship.deleteOne({ _id: id });
    return { success: true };
  }
});
