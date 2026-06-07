import { compare } from 'bcrypt-ts';
import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { UserService } from '~~/server/services/user.service';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth, AUTH_COOKIE_NAME } from '~~/server/utils/auth';
import { deleteAccountSchema, throwZodError } from '~~/server/utils/validation';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);

  // 1. Read and validate password
  const body = await readBody(event);
  const validation = deleteAccountSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { password } = validation.data;

  // 2. Verify password
  const userResults = await db.select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId));

  if (userResults.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  const isMatch = await compare(password, userResults[0].passwordHash);
  if (!isMatch) {
    throw createError({ statusCode: 403, statusMessage: 'Current password is incorrect' });
  }

  // 3. Delete user and all associated data
  const result = await UserService.deleteUser(db, userId, event);

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  // 4. Clear auth cookie
  deleteCookie(event, AUTH_COOKIE_NAME, {
    path: '/'
  });

  return { message: 'User and all associated data deleted successfully', data: result[0] };
});

