import { User } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  await requireAuth(event);
  const { friendId } = getQuery(event);
  
  const user = await User.findById(friendId).select('-passwordHash').lean();
  
  if (!user) throw createError({ statusCode: 404 });
  return { ...user, id: user._id.toString() };
});
