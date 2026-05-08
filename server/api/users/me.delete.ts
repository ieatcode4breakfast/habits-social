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

  // Note: Neon HTTP driver does not support transactions in this environment.
  // We perform sequential deletes in order of dependency.
  await db.delete(bucketLogs).where(eq(bucketLogs.ownerId, userId));
  await db.delete(habitLogs).where(eq(habitLogs.ownerId, userId));
  
  await db.delete(shareEvents).where(or(
    eq(shareEvents.ownerId, userId),
    eq(shareEvents.recipientId, userId)
  ));
  
  await db.delete(syncDeletions).where(eq(syncDeletions.ownerId, userId));
  await db.delete(sharedBucketMembers).where(eq(sharedBucketMembers.userId, userId));
  await db.delete(bucketHabits).where(eq(bucketHabits.addedBy, userId));
  
  await db.delete(buckets).where(eq(buckets.ownerId, userId));
  await db.delete(habits).where(eq(habits.ownerId, userId));
  
  await db.delete(friendships).where(or(
    eq(friendships.initiatorId, userId),
    eq(friendships.receiverId, userId)
  ));

  const result = await db.delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return { message: 'User and all associated data deleted successfully', data: result[0] };
});

