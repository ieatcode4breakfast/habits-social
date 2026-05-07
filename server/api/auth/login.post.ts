import { compare } from 'bcrypt-ts';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken } from '~~/server/utils/auth';
import { loginSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { identifier, password } = validation.data;

  const users = await sql`SELECT id, email, username, photo_url, password_hash FROM users WHERE email ILIKE ${identifier} OR username ILIKE ${identifier}`;
  const user = (users as any[])[0];

  if (!user) {
    // Mitigate timing attack: perform a dummy comparison if user is not found
    await compare(password, '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgNIhp.pX7wMQRpM64ls7ZSXH0uz');
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
