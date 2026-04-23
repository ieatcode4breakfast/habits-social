import bcrypt from 'bcryptjs';
import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { generateToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const { email, password } = await readBody(event);

  if (!email || !password)
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' });

  const existing = await User.findOne({ email });
  if (existing) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const displayname = email.split('@')[0];
  const newUser = await User.create({ email, passwordHash, displayname });

  const token = generateToken(newUser._id.toString());
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { user: { id: newUser._id, email: newUser.email, displayname: newUser.displayname } };
});
