import { eq, or, sql } from 'drizzle-orm';
import type { H3Event } from 'h3';
import type { DBConnection } from '../types/db';
import { 
  users, 
  friendships, 
  habits, 
  habitLogs,
  buckets,
  bucketLogs,
  shareEvents,
  syncDeletions,
  bucketHabits
} from '~~/server/db/schema';
import { SocialService } from './social.service';
import { ChatService } from './chat.service';

export const UserService = {
  async deleteUser(db: DBConnection, userId: string, event: H3Event) {
    return await db.transaction(async (tx) => {
      // 1. Get all friendships to clean up social data
      const userFriendships = await tx.select()
        .from(friendships)
        .where(or(
          eq(friendships.initiatorId, userId),
          eq(friendships.receiverId, userId)
        ));

      for (const friendship of userFriendships) {
        await SocialService.cleanupFriendshipData(tx, friendship.initiatorId, friendship.receiverId);
      }

      // 2. Chat Tombstoning
      await ChatService.tombstoneUserMessages(tx, userId);

      // 3. Global scrub of sharing arrays in habits and logs
      // This handles cases where habits were shared but maybe not in a bucket, 
      // or if there are residual IDs in other people's records.
      await tx.update(habits)
        .set({ sharedWith: sql`array_remove(shared_with, ${userId})` })
        .where(sql`${userId} = ANY(shared_with)`);

      await tx.update(habitLogs)
        .set({ sharedWith: sql`array_remove(shared_with, ${userId})` })
        .where(sql`${userId} = ANY(shared_with)`);

      // 3. Delete associated data that might not be fully covered by cascades 
      // or needs explicit ordering for business logic.
      // Although schema has cascades, we perform these to ensure sync_deletions 
      // or other side effects (if any were added in the future) are triggered.
      
      // Note: We don't manually delete everything here if cascades are reliable,
      // but the original me.delete.ts was very explicit. 
      // We'll keep the explicit deletions for safety and sync attribution.

      await tx.delete(bucketLogs).where(eq(bucketLogs.ownerId, userId));
      await tx.delete(habitLogs).where(eq(habitLogs.ownerId, userId));
      
      await tx.delete(shareEvents).where(or(
        eq(shareEvents.ownerId, userId),
        eq(shareEvents.recipientId, userId)
      ));
      
      await tx.delete(syncDeletions).where(eq(syncDeletions.ownerId, userId));
      
      await tx.delete(buckets).where(eq(buckets.ownerId, userId));
      await tx.delete(habits).where(eq(habits.ownerId, userId));
      
      await tx.delete(friendships).where(or(
        eq(friendships.initiatorId, userId),
        eq(friendships.receiverId, userId)
      ));

      // 4. Finally delete the user
      const result = await tx.delete(users)
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      return result;
    });
  }
};
