import { hash } from 'bcrypt-ts';
import { useDB as _useDB } from '../_utils/db';
import { generateToken as _generateToken } from '../_utils/auth';
import { isValidEmail } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const sql = useDB(event);

  const body = await readBody(event);
  const { email, password, username, photourl } = body;

  if (!email || !password || !username) {
    throw createError({ statusCode: 400, statusMessage: 'Email, password and username are required' });
  }

  if (!isValidEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Please provide a valid email address' });
  }

  if (username.length < 3 || username.length > 20) {
    throw createError({ statusCode: 400, statusMessage: 'Username must be between 3 and 20 characters' });
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters long' });
  }

  const existingEmail = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (existingEmail.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' });
  }

  const existingUsername = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  if (existingUsername.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'This username is already taken' });
  }

  const passwordHash = await hash(password, 10);

  const result = await sql`
    INSERT INTO users (email, username, "passwordHash", "createdAt", photourl)
    VALUES (${email}, ${username}, ${passwordHash}, NOW(), ${photourl || null})
    RETURNING id, email, username, photourl
  `;

  if (result.length === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });
  }

  const user = result[0];
  const token = await generateToken(user.id, event);

  return { data: { token, id: user.id, email: user.email, username: user.username, photourl: user.photourl } };
});
