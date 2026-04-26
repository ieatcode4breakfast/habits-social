import type { IFriendship, IUser } from '../../models';
import { usePusher } from '../../utils/pusher';
import { isDummyUsername } from '../../utils/isolation';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);

  // Get current user status once
  const [me] = await sql`SELECT username FROM users WHERE id = ${userId}::uuid`;
  const isMeDummy = isDummyUsername(me?.username);

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

    // Filter profiles and friendships to respect isolation
    const filteredProfiles = profiles.filter((p: any) => isDummyUsername(p.username) === isMeDummy);
    const validProfileIds = new Set(filteredProfiles.map((p: any) => String(p.id)));

    const filteredFriendships = userFriendships.filter((f: any) => {
      const otherId = String(f.initiatorId) === String(userId) ? String(f.receiverId) : String(f.initiatorId);
      return validProfileIds.has(otherId);
    });

    const mappedFriendships = filteredFriendships.map((f: any) => ({
      ...f,
      id: f.id,
      initiatorId: f.initiatorId,
      receiverId: f.receiverId,
      participants: [f.initiatorId, f.receiverId]
    }));

    const mappedProfiles = filteredProfiles.map((p: any) => ({
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
    
    // Check isolation for friend requests
    const [target] = await sql`SELECT username FROM users WHERE id = ${targetUserId}::uuid`;
    if (!target) throw createError({ statusCode: 404 });

    if (isMeDummy !== isDummyUsername(target.username)) {
      throw createError({ 
        statusCode: 403, 
        statusMessage: 'You can only send friend requests to users in your own group.' 
      });
    }

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
