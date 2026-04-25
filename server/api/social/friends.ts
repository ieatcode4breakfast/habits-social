import type { IFriendship, IUser } from '../../models';
import { ObjectId } from 'mongodb';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const userFriendships = await db.collection<IFriendship>('friendships').find({
      $or: [
        { initiatorId: userId },
        { receiverId: userId }
      ]
    }).toArray();
    
    const friendIds = userFriendships.map((f: any) => 
      f.initiatorId.toString() === userId ? f.receiverId : f.initiatorId
    );
    
    let profiles: any[] = [];
    if (friendIds.length > 0) {
      const objectIds = friendIds.map((id: string) => new ObjectId(id));
      profiles = await db.collection<IUser>('users').find(
        { _id: { $in: objectIds } },
        { projection: { passwordHash: 0 } }
      ).toArray();
    }

    const mappedFriendships = userFriendships.map((f: any) => ({
      ...f,
      id: f._id.toString(),
      initiatorId: f.initiatorId.toString(),
      receiverId: f.receiverId.toString(),
      participants: [f.initiatorId.toString(), f.receiverId.toString()]
    }));

    const mappedProfiles = profiles.map((p: any) => ({
      ...p,
      id: p._id.toString()
    }));

    return {
      friendships: mappedFriendships,
      profiles: mappedProfiles
    };
  }

  if (event.method === 'POST') {
    const { targetUserId } = await readBody(event);

    const existing = await db.collection<IFriendship>('friendships').findOne({
      $or: [
        { initiatorId: userId, receiverId: targetUserId },
        { initiatorId: targetUserId, receiverId: userId }
      ]
    });

    if (existing) throw createError({ statusCode: 400, statusMessage: 'Friendship already exists' });

    const newFriendship = {
      initiatorId: userId,
      receiverId: targetUserId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<IFriendship>('friendships').insertOne(newFriendship);

    return { 
      ...newFriendship, 
      id: result.insertedId.toString(),
      initiatorId: newFriendship.initiatorId.toString(),
      receiverId: newFriendship.receiverId.toString(),
      participants: [newFriendship.initiatorId.toString(), newFriendship.receiverId.toString()]
    };
  }
});
