import { Friendship, User } from '../../models';
import { connectDB } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    // Get all friendships for user
    const friendships = await Friendship.find({ participants: userId }).lean();
    
    // We also need to get the profiles for these participants
    const participantIds = new Set<string>();
    friendships.forEach((f: any) => {
      f.participants.forEach((p: any) => participantIds.add(p.toString()));
    });
    participantIds.delete(userId);

    const users = await User.find({ _id: { $in: Array.from(participantIds) } }).lean();
    const profiles = users.map((u: any) => ({ id: u._id.toString(), email: u.email, displayname: u.displayname, photourl: u.photourl }));

    return {
      friendships: friendships.map((f: any) => ({ ...f, id: f._id.toString() })),
      profiles
    };
  }

  if (event.method === 'POST') {
    // Send a friend request
    const body = await readBody(event);
    const { targetUserId } = body;

    if (!targetUserId) throw createError({ statusCode: 400 });

    const participants = [userId, targetUserId].sort();
    
    const existing = await Friendship.findOne({ participants: { $all: participants } });
    if (existing) return { success: true };

    await Friendship.create({
      participants,
      initiatorid: userId,
      receiverid: targetUserId,
      status: 'pending'
    });
    return { success: true };
  }
});
