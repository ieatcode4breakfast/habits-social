import { hash } from 'bcrypt-ts';
import { or, eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken, BCRYPT_COST_FACTOR } from '~~/server/utils/auth';
import { registerSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const db = useDB(event);

  const body = await readBody(event);
  const validation = registerSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { email, password, username, photoUrl } = validation.data;

  const existingUser = await db.select({ id: users.id })
    .from(users)
    .where(or(
      eq(sql`lower(${users.email})`, email.toLowerCase()),
      eq(sql`lower(${users.username})`, username.toLowerCase())
    ))
    .limit(1);

  if (existingUser.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email or username already taken' });
  }

  const passwordHash = await hash(password, BCRYPT_COST_FACTOR);

  const result = await db.insert(users)
    .values({
      id: crypto.randomUUID(),
      email,
      username,
      passwordHash,
      photoUrl: photoUrl || null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      photoUrl: users.photoUrl
    });

  if (result.length === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });
  }

  const user = result[0];
  const token = await generateToken(user.id, event);

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax'
  });

  return { data: { token, id: user.id, email: user.email, username: user.username, photoUrl: user.photoUrl } };
});

