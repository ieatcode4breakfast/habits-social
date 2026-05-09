import { compare } from 'bcrypt-ts';
import { or, eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken, DUMMY_HASH } from '~~/server/utils/auth';
import { loginSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const db = useDB(event);

  const body = await readBody(event);
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { identifier, password } = validation.data;

  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl,
    passwordHash: users.passwordHash
  })
  .from(users)
  .where(or(
    eq(sql`lower(${users.email})`, identifier.toLowerCase()),
    eq(sql`lower(${users.username})`, identifier.toLowerCase())
  ))
  .limit(1);

  const user = results[0];

  if (!user) {
    // Mitigate timing attack: perform a dummy comparison if user is not found
    await compare(password, DUMMY_HASH);
    throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });
  }

  const isMatch = await compare(password, user.passwordHash);
  if (!isMatch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });
  }

  const token = await generateToken(user.id, event);

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax'
  });

  return {
    data: {
      token,
      id: user.id,
      email: user.email,
      username: user.username,
      photoUrl: user.photoUrl
    }
  };
});

