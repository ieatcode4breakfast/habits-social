import { compare } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const db = await useDB();
  const { email, password } = await readBody(event);

  if (!email || !password)
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' });

  const user = await db.collection<IUser>('users').findOne({ email });
  
  if (!user) throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });

  const isMatch = await compare(password, user.passwordHash);
  if (!isMatch) throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });

  const token = await generateToken(user._id!.toString(), event);
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { 
    user: { 
      id: user._id!.toString(), 
      email: user.email, 
      username: user.username, 
      photourl: user.photourl 
    } 
  };
});
