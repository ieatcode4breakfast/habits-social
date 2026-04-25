import { hash } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const db = await useDB(event);
  const { email, password, username } = await readBody(event);
  
  if (!email || !password || !username)
    throw createError({ statusCode: 400, statusMessage: 'Email, password and username are required' });

  if (username.length < 3 || username.length > 20)
    throw createError({ statusCode: 400, statusMessage: 'Username must be between 3 and 20 characters' });

  if (password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters long' });

  const existingEmail = await db.collection<IUser>('users').findOne({ email });
  if (existingEmail) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });

  const existingUsername = await db.collection<IUser>('users').findOne({ username });
  if (existingUsername) throw createError({ statusCode: 400, statusMessage: 'This username is already taken' });

  const passwordHash = await hash(password, 10);
  
  const result = await db.collection<IUser>('users').insertOne({ 
    email, 
    username, 
    passwordHash,
    createdAt: new Date()
  });

  if (!result.insertedId) throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });

  const token = await generateToken(result.insertedId.toString(), event);
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { user: { id: result.insertedId.toString(), email, username } };
});
