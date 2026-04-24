import { IUser } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const userId = await requireAuth(event);
  const { username } = getQuery(event);
  if (!username) return [];

  const results = await db.collection<IUser>('users').find(
    {
      username: { $regex: String(username), $options: 'i' },
      _id: { $ne: new ObjectId(userId) }
    },
    { projection: { username: 1, email: 1, photourl: 1 } }
  ).toArray();

  return results.map((u: any) => ({
    ...u,
    id: u._id.toString()
  }));
});
