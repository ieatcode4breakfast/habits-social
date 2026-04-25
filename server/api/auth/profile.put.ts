import { hash } from 'bcrypt-ts';
import type { IUser } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
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

  const result = await db.collection<IUser>('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  return {
    user: {
      id: result._id!.toString(),
      email: result.email,
      username: result.username,
      photourl: result.photourl
    }
  };
});
