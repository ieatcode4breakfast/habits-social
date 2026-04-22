import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  requireAuth(event);
  const query = getQuery(event);
  const friendId = query.friendId ? String(query.friendId) : null;

  if (!friendId) return null;

  const user = await User.findById(friendId).lean();
  if (!user) return null;

  return { id: user._id.toString(), email: user.email, displayname: user.displayname, photourl: user.photourl };
});
