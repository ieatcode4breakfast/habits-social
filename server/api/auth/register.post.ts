import { hash } from 'bcrypt-ts';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken } from '~~/server/utils/auth';
import { registerSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const sql = useDB(event);

  const body = await readBody(event);
  const validation = registerSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { email, password, username, photoUrl } = validation.data;

  const existingUser = await sql`SELECT 1 FROM users WHERE email ILIKE ${email} OR username ILIKE ${username}`;
  if ((existingUser as any[]).length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email or username already taken' });
  }

  const passwordHash = await hash(password, 10);

  const result = await sql`
    INSERT INTO users (email, username, password_hash, created_at, photo_url)
    VALUES (${email}, ${username}, ${passwordHash}, NOW(), ${photoUrl || null})
    RETURNING id, email, username, photo_url
  `;

  if ((result as any[]).length === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });
  }

  const user = (result as any[])[0];
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
