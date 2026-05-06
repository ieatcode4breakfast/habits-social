import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { hash } from 'bcrypt-ts';
import type { IUser } from '../_types';
import { updateProfileSchema, throwZodError } from '../_utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const sql = useDB(event);

  // 1. Read and strictly validate body
  const body = await readBody(event);
  const validation = updateProfileSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { username, email, password, photourl } = validation.data;


  // 2. Fetch current user
  const users = await sql`SELECT id, email, username, photourl, "passwordHash", "emailVerifiedAt" FROM users WHERE id = ${userId}::uuid`;
  if (users.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  const user = users[0] as IUser;

  // 3. Unique constraints checks
  if (username && username !== user.username) {
    const existingUsername = await sql`SELECT 1 FROM users WHERE username ILIKE ${username} AND id != ${userId}::uuid`;
    if (existingUsername.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'This username is already taken' });
    }
  }

  if (email && email !== user.email) {
    const existingEmail = await sql`SELECT 1 FROM users WHERE email ILIKE ${email} AND id != ${userId}::uuid`;
    if (existingEmail.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' });
    }
  }

  // 4. Prepare update values
  const newUsername = username !== undefined ? username : user.username;
  const newEmail = email !== undefined ? email : user.email;
  const newPhotourl = photourl !== undefined ? photourl : user.photourl;
  const newEmailVerifiedAt = (email !== undefined && email !== user.email) ? null : user.emailVerifiedAt;
  let newPasswordHash = user.passwordHash;
  
  if (password) {
    newPasswordHash = await hash(password, 10);
  }

  // 5. Execute DB update
  const result = await sql`
    UPDATE users 
    SET 
      username = ${newUsername}, 
      email = ${newEmail}, 
      photourl = ${newPhotourl}, 
      "passwordHash" = ${newPasswordHash},
      "emailVerifiedAt" = ${newEmailVerifiedAt},
      "updatedAt" = NOW()
    WHERE id = ${userId}::uuid
    RETURNING id, email, username, photourl, "emailVerifiedAt", "createdAt", "updatedAt"
  `;

  return { data: result[0] };
});
