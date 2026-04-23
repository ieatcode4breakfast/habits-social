import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { getUserFromEvent } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = getUserFromEvent(event);
  if (!userId) return { user: null };

  await connectDB();
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) return { user: null };

  return { user: { id: user._id, email: user.email, displayname: user.displayname, photourl: user.photourl } };
});
