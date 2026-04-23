import { Friendship, User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    const friendships = await Friendship.find({ participants: userId }).lean();
    const friendIds = [...new Set(
      friendships.flatMap((f: any) => f.participants.map((p: any) => p.toString()).filter((id: string) => id !== userId))
    )];
    const profiles = await User.find({ _id: { $in: friendIds } }).select('-passwordHash').lean();
    return {
      friendships: friendships.map((f: any) => ({
        ...f,
        id: f._id.toString(),
        participants: f.participants.map((p: any) => p.toString()),
        initiatorid: f.initiatorid.toString(),
        receiverid: f.receiverid.toString()
      })),
      profiles: profiles.map((p: any) => ({ ...p, id: p._id.toString() }))
    };
  }

  if (event.method === 'POST') {
    const { targetUserId } = await readBody(event);
    const existing = await Friendship.findOne({ participants: { $all: [userId, targetUserId] } });
    if (existing) throw createError({ statusCode: 400, statusMessage: 'Friendship already exists' });
    const friendship = await Friendship.create({
      participants: [userId, targetUserId],
      initiatorid: userId,
      receiverid: targetUserId,
      status: 'pending'
    });
    return { ...friendship.toObject(), id: friendship._id.toString() };
  }
});
