import { and, eq, inArray, or } from 'drizzle-orm';
import { friendships, userBlocks } from '~~/server/db/schema';
import type { DBConnection } from '~~/server/types/db';

export const sanitizeHabitShareRecipientIds = async (
  db: DBConnection,
  ownerId: string,
  candidateIds: readonly string[]
): Promise<string[]> => {
  const uniqueCandidateIds = [...new Set(candidateIds.map(String))].filter((id) => id !== ownerId);
  if (uniqueCandidateIds.length === 0) return [];

  const friendshipsRes = await db.select({
    initiatorId: friendships.initiatorId,
    receiverId: friendships.receiverId
  })
    .from(friendships)
    .where(and(
      inArray(friendships.status, ['accepted', 'pending']),
      or(
        and(eq(friendships.initiatorId, ownerId), inArray(friendships.receiverId, uniqueCandidateIds)),
        and(eq(friendships.receiverId, ownerId), inArray(friendships.initiatorId, uniqueCandidateIds))
      )
    ));

  const allowedIds = new Set(friendshipsRes.map((friendship) =>
    friendship.initiatorId === ownerId ? friendship.receiverId : friendship.initiatorId
  ));

  if (allowedIds.size === 0) return [];

  const blockRows = await db.select({
    blockerId: userBlocks.blockerId,
    blockedId: userBlocks.blockedId
  })
    .from(userBlocks)
    .where(or(
      and(eq(userBlocks.blockerId, ownerId), inArray(userBlocks.blockedId, uniqueCandidateIds)),
      and(eq(userBlocks.blockedId, ownerId), inArray(userBlocks.blockerId, uniqueCandidateIds))
    ));

  for (const block of blockRows) {
    allowedIds.delete(block.blockerId === ownerId ? block.blockedId : block.blockerId);
  }

  return uniqueCandidateIds.filter((id) => allowedIds.has(id));
};

export const hasHabitVisibility = async (
  db: DBConnection,
  viewerId: string,
  ownerId: string,
  sharedWith: readonly string[] | null
): Promise<boolean> => {
  if (viewerId === ownerId) return true;
  if (!sharedWith?.map(String).includes(viewerId)) return false;

  const [block] = await db.select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(or(
      and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, ownerId)),
      and(eq(userBlocks.blockerId, ownerId), eq(userBlocks.blockedId, viewerId))
    ))
    .limit(1);

  return !block;
};
