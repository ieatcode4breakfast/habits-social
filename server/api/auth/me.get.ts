import type { IUser } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  const userId = await requireAuth(event);

  const user = await db.collection<IUser>('users').findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { 
    user: {
      id: user._id!.toString(),
      email: user.email,
      username: user.username,
      photourl: user.photourl
    } 
  };
});
