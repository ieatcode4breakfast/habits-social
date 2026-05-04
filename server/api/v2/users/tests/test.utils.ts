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

export const createMockEvent = (userId: string, body: any = {}, cookies: any = {}) => {
  return {
    _body: body,
    _cookies: {
      auth_token: 'mock-token', 
      ...cookies
    },
    context: {
      userId,
      requireAuth: async (event: any) => {
        if (event._cookies?.auth_token === 'invalid') {
          throw (global as any).createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }
        return event.context.userId;
      },
      useDB: () => neon(process.env.DATABASE_URL!)
    }
  } as any;
};
