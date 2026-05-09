import { hash } from 'bcrypt-ts';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql } from 'drizzle-orm';
import { users, habits, buckets, friendships } from '../db/schema';
import * as schema from '../db/schema';
import { InferSelectModel } from 'drizzle-orm';

export type User = InferSelectModel<typeof users>;
export type Habit = InferSelectModel<typeof habits>;
export type Bucket = InferSelectModel<typeof buckets>;
export type Friendship = InferSelectModel<typeof friendships>;

// Initialize direct DB connection for setup/teardown
const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });


export const createTestUser = async (username: string, email: string): Promise<User> => {
  const passwordHash = await hash('password123', 10);
  const result = await db.insert(users)
    .values({
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  if (!result[0]) throw new Error('Failed to create test user');
  return result[0];
};

export const deleteTestUser = async (userId: string) => {
  await db.delete(users).where(eq(users.id, userId));
};

export const createMockEvent = (userId: string, body: any = {}, cookies: any = {}, params: any = {}, query: any = {}, method: string = 'GET') => {
  return {
    _body: body,
    _cookies: {
      auth_token: 'mock-token', 
      ...cookies
    },
    _params: params,
    _query: query,
    _method: method,
    method,
    context: {
      userId,
      requireAuth: async (event: any) => {
        if (event._cookies?.auth_token === 'invalid') {
          throw (global as any).createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }
        return event.context.userId;
      },
      useDB: () => {
        return db;
      },
      generateToken: async (uid: string) => `mock-token-${uid}`
    }
  } as any;
};

export const createTestHabit = async (ownerId: string, title: string): Promise<Habit> => {
  const result = await db.insert(habits)
    .values({
      id: crypto.randomUUID(),
      ownerId,
      title,
      description: '',
      skipsCount: 2,
      skipsPeriod: 'weekly',
      color: '#6366f1',
      sharedWith: [],
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  if (!result[0]) throw new Error('Failed to create test habit');
  return result[0];
};

export const deleteTestHabit = async (habitId: string) => {
  await db.delete(habits).where(eq(habits.id, habitId));
};

export const createTestHabitLog = async (ownerId: string, habitId: string, date: string, status: string = 'completed'): Promise<any> => {
  const result = await db.insert(schema.habitLogs)
    .values({
      id: `${habitId}_${date}`,
      ownerId,
      habitId,
      date,
      status,
      updatedAt: new Date()
    })
    .returning();
  return result[0];
};

export const createTestBucket = async (ownerId: string, title: string): Promise<Bucket> => {
  const result = await db.insert(buckets)
    .values({
      id: crypto.randomUUID(),
      ownerId,
      title,
      description: '',
      color: '#6366f1',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  if (!result[0]) throw new Error('Failed to create test bucket');
  return result[0];
};

export const deleteTestBucket = async (bucketId: string) => {
  await db.delete(buckets).where(eq(buckets.id, bucketId));
};

export const createFriendship = async (initiatorId: string, receiverId: string, status: 'pending' | 'accepted' = 'accepted'): Promise<Friendship> => {
  const result = await db.insert(friendships)
    .values({
      id: crypto.randomUUID(),
      initiatorId,
      receiverId,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  if (!result[0]) throw new Error('Failed to create test friendship');
  return result[0];
};

export const deleteFriendship = async (friendshipId: string) => {
  await db.delete(friendships).where(eq(friendships.id, friendshipId));
};

export const shareHabitWithUser = async (habitId: string, targetUserId: string) => {
  await db.update(habits)
    .set({
      sharedWith: sql`array_append(${habits.sharedWith}, ${targetUserId})`,
      updatedAt: new Date()
    })
    .where(eq(habits.id, habitId));
};

export const createTestDeletion = async (ownerId: string, entityId: string, entityType: string): Promise<any> => {
  const result = await db.insert(schema.syncDeletions)
    .values({
      id: crypto.randomUUID(),
      ownerId,
      entityId,
      entityType,
      createdAt: new Date()
    })
    .returning();
  return result[0];
};

export const generateMassiveString = (length: number = 10001) => {
  return 'A'.repeat(length);
};
