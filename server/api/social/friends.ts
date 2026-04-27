import type { IFriendship, IUser } from '../../models';
import { usePusher } from '../../utils/pusher';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  if (event.method === 'GET') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate');
    
    const userFriendships = await sql`
      SELECT * FROM friendships 
      WHERE "initiatorId" = ${userId} OR "receiverId" = ${userId}
    `;
    
    const friendIds = userFriendships.map((f: any) => 
      String(f.initiatorId) === String(userId) ? f.receiverId : f.initiatorId
    );
    
    let profiles: any[] = [];
    if (friendIds.length > 0) {
      profiles = await sql`
        SELECT id, email, username, photourl FROM users 
        WHERE id = ANY(${friendIds}::uuid[])
      `;
    }

    const mappedFriendships = userFriendships.map((f: any) => ({
      ...f,
      id: f.id,
      initiatorId: f.initiatorId,
      receiverId: f.receiverId,
      participants: [f.initiatorId, f.receiverId]
    }));

    const mappedProfiles = profiles.map((p: any) => ({
      ...p,
      id: p.id
    }));

    return {
      friendships: mappedFriendships,
      profiles: mappedProfiles
    };
  }

  if (event.method === 'POST') {
    const { targetUserId } = await readBody(event);
    
    const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;
    if (!target) throw createError({ statusCode: 404 });

    const existing = await sql`
      SELECT * FROM friendships 
      WHERE ("initiatorId" = ${userId} AND "receiverId" = ${targetUserId})
         OR ("initiatorId" = ${targetUserId} AND "receiverId" = ${userId})
    `;

    if (existing.length > 0) throw createError({ statusCode: 400, statusMessage: 'Friendship already exists' });

    const result = await sql`
      INSERT INTO friendships ("initiatorId", "receiverId", status, "createdAt", "updatedAt")
      VALUES (${userId}, ${targetUserId}, 'pending', NOW(), NOW())
      RETURNING *
    `;
    
    const newFriendship = result[0];
    if (!newFriendship) throw createError({ statusCode: 500, statusMessage: 'Failed to create friendship' });

    const pusher = usePusher();
    if (pusher) {
      pusher.trigger(`user-${targetUserId}-social`, 'friend-request-received', newFriendship);
    }

    return { 
      ...newFriendship, 
      id: newFriendship!.id,
      initiatorId: newFriendship!.initiatorId,
      receiverId: newFriendship!.receiverId,
      participants: [newFriendship!.initiatorId, newFriendship!.receiverId]
    };
  }
});
