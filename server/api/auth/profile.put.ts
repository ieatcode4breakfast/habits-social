import { hash } from 'bcrypt-ts';
import { User } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);
  const { username, email, password, photourl } = await readBody(event);

  const updateData: any = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (photourl) updateData.photourl = photourl;
  if (password) {
    updateData.passwordHash = await hash(password, 10);
  }

  if (Object.keys(updateData).length === 0) {
    return { message: 'No changes made' };
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

  if (!updatedUser) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  return {
    user: {
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      username: updatedUser.username,
      photourl: updatedUser.photourl
    }
  };
});
