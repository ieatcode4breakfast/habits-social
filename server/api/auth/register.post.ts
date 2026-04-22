import bcrypt from 'bcryptjs';
import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { generateToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event);
  const { email, password, displayname } = body;

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' });
  }

  const existingUser = await (User as any).findOne({ email });
  if (existingUser) {
    throw createError({ statusCode: 400, statusMessage: 'User already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const name = displayname || email.split('@')[0];

  const newUser = await User.create({
    email,
    passwordHash,
    displayname: name,
  });

  const token = generateToken(newUser._id.toString());
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'strict'
  });

  return {
    user: {
      id: newUser._id,
      email: newUser.email,
      displayname: newUser.displayname,
    }
  };
});
