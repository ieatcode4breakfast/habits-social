import { z } from 'zod';
import { useDB as _useDB } from '../_utils/db';
import { requireAuth as _requireAuth } from '../_utils/auth';
import { hash } from 'bcrypt-ts';
import type { IUser } from '../_types';

// Strict schema for updating a user
const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  photourl: z.string().or(z.literal('')).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field (username, email, password, photourl) must be provided to update"
});

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const sql = useDB(event);

  // 1. Read and strictly validate body
  const body = await readBody(event);
  const validation = updateProfileSchema.safeParse(body);
  
  if (!validation.success) {
    throw createError({ 
      statusCode: 400, 
      statusMessage: 'Validation Failed', 
      data: validation.error.flatten() 
    });
  }

  const { username, email, password, photourl } = validation.data;

  // 1.5. Verify photourl works if provided
  if (photourl && photourl.startsWith('http')) {
    try {
      const response = await $fetch.raw(photourl, { method: 'HEAD', timeout: 5000 });
      if (!response.ok) {
        throw createError({ statusCode: 400, statusMessage: 'The provided avatar URL is unreachable' });
      }
    } catch (err) {
      // If HEAD fails, try a simple GET as some CDNs block HEAD
      try {
        await $fetch(photourl, { method: 'GET', timeout: 5000 });
      } catch (innerErr) {
        throw createError({ statusCode: 400, statusMessage: 'Failed to verify avatar URL. Please ensure it is a public, reachable image.' });
      }
    }
  }

  // 2. Fetch current user
  const users = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
  if (users.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  const user = users[0] as IUser;

  // 3. Unique constraints checks
  if (username && username !== user.username) {
    const existingUsername = await sql`SELECT 1 FROM users WHERE username = ${username} AND id != ${userId}::uuid`;
    if (existingUsername.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'This username is already taken' });
    }
  }

  if (email && email !== user.email) {
    const existingEmail = await sql`SELECT 1 FROM users WHERE email = ${email} AND id != ${userId}::uuid`;
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
      "emailVerifiedAt" = ${newEmailVerifiedAt}
    WHERE id = ${userId}::uuid
    RETURNING id, email, username, photourl, "emailVerifiedAt", "createdAt"
  `;

  return { data: result[0] };
});
