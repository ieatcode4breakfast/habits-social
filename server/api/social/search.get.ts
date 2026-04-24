import { User } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];

  const results = await User.find({
    username: { $regex: String(username), $options: 'i' },
    _id: { $ne: userId }
  })
  .select('username email photourl')
  .lean();

  return results.map((u: any) => ({
    ...u,
    id: u._id.toString()
  }));
});
