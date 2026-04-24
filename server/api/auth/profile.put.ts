import { hash } from 'bcrypt-ts';
import { users } from '../../models';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
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

  const updatedUser = await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updatedUser) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  return {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      photourl: updatedUser.photourl
    }
  };
});
