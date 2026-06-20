import { eq, and, ne, or, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth, BCRYPT_COST_FACTOR } from '~~/server/utils/auth';
import { hash, compare } from 'bcrypt-ts';
import { updateProfileSchema, throwZodError } from '~~/server/utils/validation';
import { generalCheckRateLimit } from '~~/server/utils/generalRateLimit';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);
  await generalCheckRateLimit(event, userId);

  // 1. Read and strictly validate body
  const body = await readBody(event);
  const validation = updateProfileSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { username, email, password, currentPassword, photoUrl } = validation.data;


  // 2. Fetch current user
  const userResults = await db.select().from(users).where(eq(users.id, userId));
  if (userResults.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  const user = userResults[0];

  // 3. Unique constraints checks
  if (username && username !== user.username) {
    const existingUsername = await db.select({ id: users.id })
      .from(users)
      .where(and(
        eq(sql`lower(${users.username})`, username.toLowerCase()),
        ne(users.id, userId)
      ))
      .limit(1);
    if (existingUsername.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'This username is already taken' });
    }
  }

  if (email && email !== user.email) {
    const existingEmail = await db.select({ id: users.id })
      .from(users)
      .where(and(
        eq(sql`lower(${users.email})`, email.toLowerCase()),
        ne(users.id, userId)
      ))
      .limit(1);
    if (existingEmail.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' });
    }
  }

  // 4. Verify current password if changing sensitive fields
  const isChangingSensitiveFields = password !== undefined || (email !== undefined && email !== user.email);
  if (isChangingSensitiveFields) {
    if (!currentPassword) {
      throw createError({ statusCode: 403, statusMessage: 'Current password is required' });
    }
    const isMatch = await compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw createError({ statusCode: 403, statusMessage: 'Current password is incorrect' });
    }
  }

  // 5. Prepare update values
  let newPasswordHash = user.passwordHash;
  if (password) {
    newPasswordHash = await hash(password, BCRYPT_COST_FACTOR);
  }

  const newEmailVerifiedAt = (email !== undefined && email !== user.email) ? null : user.emailVerifiedAt;

  // 5. Execute DB update
  const result = await db.update(users)
    .set({
      username: username ?? user.username,
      email: email ?? user.email,
      photoUrl: photoUrl ?? user.photoUrl,
      passwordHash: newPasswordHash,
      emailVerifiedAt: newEmailVerifiedAt,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      photoUrl: users.photoUrl,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    });

  return { data: result[0] };
});

