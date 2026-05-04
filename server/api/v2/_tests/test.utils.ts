import { hash } from 'bcrypt-ts';
import { neon } from '@neondatabase/serverless';

// Initialize direct DB connection for setup/teardown
const sql = neon(process.env.DATABASE_URL!);

export const createTestUser = async (username: string, email: string) => {
  const passwordHash = await hash('password123', 10);
  const result = await sql`
    INSERT INTO users (username, email, "passwordHash", "createdAt")
    VALUES (${username}, ${email}, ${passwordHash}, NOW())
    RETURNING id, username, email
  `;
  return result[0];
};

export const deleteTestUser = async (userId: string) => {
  await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
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
      useDB: () => neon(process.env.DATABASE_URL!),
      generateToken: async (uid: string) => `mock-token-${uid}`
    }
  } as any;
};

export const createTestHabit = async (ownerid: string, title: string) => {
  const result = await sql`
    INSERT INTO habits (ownerid, title, description, "skipsCount", "skipsPeriod", color, sharedwith, "sortOrder", "createdAt", updatedat)
    VALUES (${ownerid}, ${title}, '', 2, 'weekly', '#6366f1', '{}', 0, NOW(), NOW())
    RETURNING id, title, ownerid
  `;
  return result[0];
};

export const deleteTestHabit = async (habitId: string) => {
  await sql`DELETE FROM habits WHERE id = ${habitId}::uuid`;
};

export const createTestBucket = async (ownerid: string, title: string) => {
  const result = await sql`
    INSERT INTO buckets (id, ownerid, title, description, color, "sortOrder", "createdAt", updatedat)
    VALUES (gen_random_uuid(), ${ownerid}, ${title}, '', '#6366f1', 0, NOW(), NOW())
    RETURNING id, title, ownerid
  `;
  return result[0];
};

export const deleteTestBucket = async (bucketId: string) => {
  await sql`DELETE FROM buckets WHERE id = ${bucketId}::uuid`;
};
