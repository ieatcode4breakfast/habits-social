import { friendships, users } from '../../models';
import { eq, or, and, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const userId = requireAuth(event);

  if (event.method === 'GET') {
    const userFriendships = await db.select().from(friendships)
      .where(or(eq(friendships.initiatorId, userId), eq(friendships.receiverId, userId)));
    
    const friendIds = userFriendships.map((f: any) => f.initiatorId === userId ? f.receiverId : f.initiatorId);
    
    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await db.select({
        id: users.id,
        email: users.email,
        username: users.username,
        photourl: users.photourl,
        createdAt: users.createdAt,
      }).from(users).where(inArray(users.id, friendIds));
    }

    return {
      friendships: userFriendships,
      profiles: profiles
    };
  }

  if (event.method === 'POST') {
    const { targetUserId } = await readBody(event);
    const targetId = Number(targetUserId);

    const existing = await db.select().from(friendships).where(
      or(
        and(eq(friendships.initiatorId, userId), eq(friendships.receiverId, targetId)),
        and(eq(friendships.initiatorId, targetId), eq(friendships.receiverId, userId))
      )
    ).get();

    if (existing) throw createError({ statusCode: 400, statusMessage: 'Friendship already exists' });

    const result = await db.insert(friendships).values({
      initiatorId: userId,
      receiverId: targetId,
      status: 'pending'
    }).returning().get();

    return result;
  }
});
