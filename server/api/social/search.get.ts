import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];
  const users = await User.find({ 
    username: { $regex: new RegExp(String(username), 'i') }, 
    _id: { $ne: userId } 
  }).lean();
  return users.map((u: any) => ({ ...u, id: u._id.toString() }));
});
