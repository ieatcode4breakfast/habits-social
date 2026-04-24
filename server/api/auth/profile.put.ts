import bcrypt from 'bcryptjs';
import { User } from '../../models';
import { connectDB } from '../../utils/db';
import { getUserFromEvent } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = getUserFromEvent(event);
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  await connectDB();
  const body = await readBody(event);
  const { username, email, password } = body;

  const user = await User.findById(userId);
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }

  // 1. Validate Username uniqueness if changed
  if (username && username !== user.username) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw createError({ statusCode: 400, message: 'Username must be 3-20 characters (alphanumeric and underscores only).' });
    }
    const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      throw createError({ statusCode: 400, message: 'Username is already taken.' });
    }
    
    user.username = username;
  }

  // 2. Validate Email uniqueness if changed
  if (email && email !== user.email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      throw createError({ statusCode: 400, message: 'Email is already registered.' });
    }
    user.email = email.toLowerCase();
  }

  // 3. Update Password if provided
  if (password) {
    if (password.length < 6) {
      throw createError({ statusCode: 400, message: 'Password must be at least 6 characters.' });
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
  }

  await user.save();

  return { 
    message: 'Profile updated successfully',
    user: {
      username: user.username,
      email: user.email
    }
  };
});
