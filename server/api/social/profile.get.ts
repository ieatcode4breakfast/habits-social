import type { IUser } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  await requireAuth(event);
  const { friendId } = getQuery(event);
  
  const user = await db.collection<IUser>('users').findOne(
    { _id: new ObjectId(String(friendId)) },
    { projection: { passwordHash: 0 } }
  );
  
  if (!user) throw createError({ statusCode: 404 });
  return { ...user, id: user._id!.toString() };
});
