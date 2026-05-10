import { eq, or } from 'drizzle-orm';
import { 
  users, 
  habits, 
  habitLogs, 
  buckets, 
  bucketHabits, 
  sharedBucketMembers, 
  bucketLogs, 
  shareEvents, 
  friendships, 
  syncDeletions 
} from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);

  const result = await db.transaction(async (tx) => {
    await tx.delete(bucketLogs).where(eq(bucketLogs.ownerId, userId));
    await tx.delete(habitLogs).where(eq(habitLogs.ownerId, userId));
    
    await tx.delete(shareEvents).where(or(
      eq(shareEvents.ownerId, userId),
      eq(shareEvents.recipientId, userId)
    ));
    
    await tx.delete(syncDeletions).where(eq(syncDeletions.ownerId, userId));
    await tx.delete(sharedBucketMembers).where(eq(sharedBucketMembers.userId, userId));
    await tx.delete(bucketHabits).where(eq(bucketHabits.addedBy, userId));
    
    await tx.delete(buckets).where(eq(buckets.ownerId, userId));
    await tx.delete(habits).where(eq(habits.ownerId, userId));
    
    await tx.delete(friendships).where(or(
      eq(friendships.initiatorId, userId),
      eq(friendships.receiverId, userId)
    ));

    const deleteRes = await tx.delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    return deleteRes;
  });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { message: 'User and all associated data deleted successfully', data: result[0] };
});

