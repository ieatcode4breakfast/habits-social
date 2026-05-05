import { hash } from 'bcrypt-ts';
import type { IUser } from '../../models';

export default defineEventHandler(async (event) => {
  const sql = useDB(event);
  const userId = await requireAuth(event);
  const { username, email, password, photourl } = await readBody(event);

  if (!username && !email && !password && photourl === undefined) {
    return { message: 'No changes made' };
  }

  const users = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  if (users.length === 0) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  const user = users[0] as IUser;

  // Validation
  if (username && (username.length < 3 || username.length > 20)) {
    throw createError({ statusCode: 400, statusMessage: 'Username must be between 3 and 20 characters' });
  }

  if (email && !isValidEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Please provide a valid email address' });
  }

  if (password && password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters long' });
  }

  // Unique checks
  if (username && username !== user.username) {
    const existingUsername = await sql`SELECT 1 FROM users WHERE username = ${username} AND id != ${userId}::uuid`;
    if (existingUsername.length > 0) throw createError({ statusCode: 400, statusMessage: 'This username is already taken' });
  }

  if (email && email !== user.email) {
    const existingEmail = await sql`SELECT 1 FROM users WHERE email = ${email} AND id != ${userId}::uuid`;
    if (existingEmail.length > 0) throw createError({ statusCode: 400, statusMessage: 'An account with this email already exists' });
  }

  const newUsername = username || user.username;
  const newEmail = email || user.email;
  const newPhotourl = photourl !== undefined ? photourl : user.photourl;
  let newPasswordHash = user.passwordHash;
  
  if (password) {
    newPasswordHash = await hash(password, 10);
  }

  const result = await sql`
    UPDATE users 
    SET username = ${newUsername}, email = ${newEmail}, photourl = ${newPhotourl}, "passwordHash" = ${newPasswordHash}, "updatedAt" = NOW()
    WHERE id = ${userId}::uuid
    RETURNING *
  `;

  const updatedUser = result[0] as IUser;

  return {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      photourl: updatedUser.photourl
    }
  };
});
