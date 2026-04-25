import { compare } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const { email: identifier, password } = await readBody(event);

  if (!identifier || !password)
    throw createError({ statusCode: 400, statusMessage: 'Email/Username and password are required' });

  const users = await sql`SELECT * FROM users WHERE email = ${identifier} OR username = ${identifier}`;
  const user = users[0] as IUser | undefined;

  if (!user) throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });

  const isMatch = await compare(password, user.passwordHash);
  if (!isMatch) throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });

  const token = await generateToken(user.id!, event);
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      photourl: user.photourl
    }
  };
});
