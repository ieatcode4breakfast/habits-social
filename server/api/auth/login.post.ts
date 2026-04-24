import bcrypt from 'bcryptjs';
import { users } from '../../models';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB(event);
  const { email, password } = await readBody(event);

  if (!email || !password)
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' });

  const user = await db.select().from(users).where(eq(users.email, email)).get();
  
  if (!user) throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });

  // Await the generateToken call
  const token = await generateToken(user.id.toString(), event);
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
