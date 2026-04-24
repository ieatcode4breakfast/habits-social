import { User } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);

  const user = await User.findById(userId).select('-passwordHash');

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { 
    user: {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      photourl: user.photourl
    } 
  };
});
