import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { hash } from 'bcrypt-ts';
import { normalizeUser } from '../_utils/normalize';
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

  const { username, email, password, photoUrl } = validation.data;


  // 2. Fetch current user
  const users = await sql`SELECT id, email, username, photo_url, password_hash, email_verified_at FROM users WHERE id = ${userId}::uuid`;
  if ((users as any[]).length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  const user = (users as any[])[0];

  // 3. Unique constraints checks
  if (username && username !== user.username) {
    const existingUsername = await sql`SELECT 1 FROM users WHERE username ILIKE ${username} AND id != ${userId}::uuid`;
    if ((existingUsername as any[]).length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'This username is already taken' });
    }
  }

  if (email && email !== user.email) {
    const existingEmail = await sql`SELECT 1 FROM users WHERE email ILIKE ${email} AND id != ${userId}::uuid`;
    if ((existingEmail as any[]).length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' });
    }
  }

  // 4. Prepare update values
  const newUsername = username !== undefined ? username : user.username;
  const newEmail = email !== undefined ? email : user.email;
  const newPhotoUrl = photoUrl !== undefined ? photoUrl : user.photo_url;
  const newEmailVerifiedAt = (email !== undefined && email !== user.email) ? null : user.email_verified_at;
  let newPasswordHash = user.password_hash;
  
  if (password) {
    newPasswordHash = await hash(password, 10);
  }

  // 5. Execute DB update
  const result = await sql`
    UPDATE users 
    SET 
      username = ${newUsername}, 
      email = ${newEmail}, 
      photo_url = ${newPhotoUrl}, 
      password_hash = ${newPasswordHash},
      email_verified_at = ${newEmailVerifiedAt},
      updated_at = NOW()
    WHERE id = ${userId}::uuid
    RETURNING id, email, username, photo_url, email_verified_at, created_at, updated_at
  `;

  return { data: normalizeUser((result as any[])[0]) };
});
