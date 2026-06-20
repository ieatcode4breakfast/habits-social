import { readBody } from 'h3';
import { compare } from 'bcrypt-ts';
import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { UserService } from '~~/server/services/user.service';
import { useDB as _useDB } from '~~/server/utils/db';
import { requireAuth as _requireAuth, AUTH_COOKIE_NAME } from '~~/server/utils/auth';
import { deleteAccountSchema, throwZodError } from '~~/server/utils/validation';
import { generalCheckRateLimit } from '~~/server/utils/generalRateLimit';

export default defineEventHandler(async (event) => {
  const requireAuth = (event.context as any).requireAuth || _requireAuth;
  const useDB = (event.context as any).useDB || _useDB;

  const userId = await requireAuth(event);
  const db = useDB(event);
  await generalCheckRateLimit(event, userId, { maxPerIdentifier: 5, windowSeconds: 3600 });

  // 1. Read and validate password
  // On Cloudflare Workers, h3's readBody hangs for DELETE requests because
  // Nitro's fetchHandler does not consume the body for DELETE (its
  // requestHasBody regex only matches POST, PUT, PATCH). This leaves the
  // raw CF Request body intact on event.context._platform.cloudflare.request,
  // but the Node.js stream polyfill never receives the body data, so
  // readRawBody's data/end event listeners hang forever.
  //
  // Strategy:
  //   a) event._body — set by test utilities (createMockEvent)
  //   b) event.context._platform.cloudflare.request — raw CF Request on Workers
  //   c) readBody(event) — standard h3 body reader for local dev
  let body: unknown = (event as any)._body;

  if (!body) {
    const platformContext = (event.context as any)?._platform as
      | { cloudflare?: { request?: { bodyUsed: boolean; json(): Promise<unknown> } } }
      | undefined;
    const cfRequest = platformContext?.cloudflare?.request;
    if (cfRequest && !cfRequest.bodyUsed) {
      try {
        body = await cfRequest.json();
      } catch {
        // Body stream disturbed, fall through to readBody
      }
    }
  }

  if (!body) {
    body = await readBody(event);
  }
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

