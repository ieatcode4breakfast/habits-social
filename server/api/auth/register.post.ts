import { hash } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const { email, password, username, photourl } = await readBody(event);
  
  if (!email || !password || !username)
    throw createError({ statusCode: 400, statusMessage: 'Email, password and username are required' });

  if (username.length < 3 || username.length > 20)
    throw createError({ statusCode: 400, statusMessage: 'Username must be between 3 and 20 characters' });

  if (password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters long' });

  const existingEmail = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (existingEmail.length > 0) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });

  const existingUsername = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  if (existingUsername.length > 0) throw createError({ statusCode: 400, statusMessage: 'This username is already taken' });

  const passwordHash = await hash(password, 10);
  
  const result = await sql`
    INSERT INTO users (email, username, "passwordHash", "createdAt", photourl) 
    VALUES (${email}, ${username}, ${passwordHash}, NOW(), ${photourl || null}) 
    RETURNING id
  `;

  if (result.length === 0) throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });

  const insertedId = result[0].id;
  const token = await generateToken(insertedId, event);
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { user: { id: insertedId, email, username, photourl } };
});
