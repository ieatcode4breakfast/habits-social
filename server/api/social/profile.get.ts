import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  requireAuth(event);
  const { friendId } = getQuery(event);
  const user = await User.findById(String(friendId)).select('-passwordHash').lean() as any;
  if (!user) throw createError({ statusCode: 404 });
  return { ...user, id: user._id.toString() };
});
