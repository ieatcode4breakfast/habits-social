import bcrypt from 'bcryptjs';
import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { generateToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await connectDB();
  const { email, password, username } = await readBody(event);
  
  if (!email || !password || !username)
    throw createError({ statusCode: 400, statusMessage: 'Email, password and username are required' });

  const existingEmail = await User.findOne({ email });
  if (existingEmail) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });

  const existingUsername = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
  if (existingUsername) throw createError({ statusCode: 400, statusMessage: 'This username is already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const displayname = username; // Default display name to username
  const newUser = await User.create({ email, username, passwordHash, displayname });

  const token = generateToken(newUser._id.toString());
  setCookie(event, 'auth_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'strict' });

  return { user: { id: newUser._id, email: newUser.email, username: newUser.username, displayname: newUser.displayname } };
});
