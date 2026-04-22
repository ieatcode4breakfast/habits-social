import bcrypt from 'bcryptjs';
import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { generateToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event);
  const { email, password } = body;

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid credentials' });
  }

  const token = generateToken(user._id.toString());
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'strict'
  });

  return {
    user: {
      id: user._id,
      email: user.email,
      displayname: user.displayname,
      photourl: user.photourl
    }
  };
});
