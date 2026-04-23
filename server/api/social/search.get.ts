import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);
  const { email } = getQuery(event);
  if (!email) return [];
  const users = await User.find({ email: String(email), _id: { $ne: userId } }).lean();
  return users.map((u: any) => ({ ...u, id: u._id.toString() }));
});
