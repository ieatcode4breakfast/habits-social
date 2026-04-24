import bcrypt from 'bcryptjs';
import { users } from '../../models';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { email, password, username } = await readBody(event);
  
  if (!email || !password || !username)
    throw createError({ statusCode: 400, statusMessage: 'Email, password and username are required' });

  if (username.length < 3 || username.length > 20)
    throw createError({ statusCode: 400, statusMessage: 'Username must be between 3 and 20 characters' });

  if (password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters long' });

  // Check existing email
  const existingEmail = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingEmail) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });

  // Check existing username
  const existingUsername = await db.select().from(users).where(eq(users.username, username)).get();
  if (existingUsername) throw createError({ statusCode: 400, statusMessage: 'This username is already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  
  const result = await db.insert(users).values({ 
    email, 
    username, 
    passwordHash 
  }).returning().get();

  if (!result) throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });

  // Await the generateToken call
  const token = await generateToken(result.id.toString(), event);
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { user: { id: result.id, email: result.email, username: result.username } };
});
