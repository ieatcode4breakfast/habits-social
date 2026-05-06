import { compare } from 'bcrypt-ts';
import { useDB as _useDB } from '../_utils/db';
import { generateToken as _generateToken } from '../_utils/auth';
import { loginSchema, throwZodError } from '../_utils/validation';

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

  const users = await sql`SELECT * FROM users WHERE email = ${identifier} OR username = ${identifier}`;
  const user = users[0];

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

  return {
    data: {
      token,
      id: user.id,
      email: user.email,
      username: user.username,
      photourl: user.photourl
    }
  };
});
