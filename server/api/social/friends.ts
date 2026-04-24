import { Friendship, User } from '../../models';

export default defineEventHandler(async (event) => {
  await useDB();
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    const userFriendships = await Friendship.find({
      $or: [
        { initiatorId: userId },
        { receiverId: userId }
      ]
    }).lean();
    
    const friendIds = userFriendships.map((f: any) => 
      f.initiatorId.toString() === userId ? f.receiverId : f.initiatorId
    );
    
    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await User.find({ _id: { $in: friendIds } })
        .select('-passwordHash')
        .lean();
    }

    const mappedFriendships = userFriendships.map((f: any) => ({
      ...f,
      id: f._id.toString(),
      initiatorId: f.initiatorId.toString(),
      receiverId: f.receiverId.toString()
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

    const existing = await Friendship.findOne({
      $or: [
        { initiatorId: userId, receiverId: targetUserId },
        { initiatorId: targetUserId, receiverId: userId }
      ]
    });

    if (existing) throw createError({ statusCode: 400, statusMessage: 'Friendship already exists' });

    const newFriendship = await Friendship.create({
      initiatorId: userId,
      receiverId: targetUserId,
      status: 'pending'
    });

    return { ...newFriendship.toObject(), id: newFriendship._id.toString() };
  }
});
