import { compare } from 'bcrypt-ts';
import { or, eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken, setAuthCookie as _setAuthCookie, DUMMY_HASH } from '~~/server/utils/auth';
import { loginSchema, throwZodError } from '~~/server/utils/validation';
import { checkRateLimit, resetRateLimit } from '~~/server/utils/rateLimit';

// ponytail: single-line client header check; upgrade path: version matrix if more clients appear
const isAndroidClient = (event: { node?: { req?: { headers?: Record<string, string | string[] | undefined> } } }): boolean => {
  const clientHeader = getHeader(event as any, 'x-habits-client');
  return typeof clientHeader === 'string' && clientHeader.toLowerCase() === 'android/1.7.0';
};

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const setAuthCookie = (event.context as any).setAuthCookie || _setAuthCookie;
  const db = useDB(event);

  const body = await readBody(event);
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { identifier, password } = validation.data;

  // Rate limiting check
  await checkRateLimit(event, identifier);

  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl,
    passwordHash: users.passwordHash,
    sessionVersion: users.sessionVersion
  })
  .from(users)
  .where(or(
    eq(sql`lower(${users.email})`, identifier.toLowerCase()),
    eq(sql`lower(${users.username})`, identifier.toLowerCase())
  ))
  .limit(1);

  const user = results[0];

  if (!user) {
    // Mitigate timing attack: perform a dummy comparison if user is not found
    await compare(password, DUMMY_HASH);
    throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });
  }

  const isMatch = await compare(password, user.passwordHash);
  if (!isMatch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid username, email or password' });
  }

  const token = await generateToken(user.id, event, user.sessionVersion);

  // Success: Reset identifier rate limit
  await resetRateLimit(event, identifier);

  // Always set the web cookie
  setAuthCookie(event, token);

  const profileData = {
    id: user.id,
    email: user.email,
    username: user.username,
    photoUrl: user.photoUrl
  };

  // Only include the raw token for Android native clients (Keystore storage).
  // Web/PWA clients authenticate via the HttpOnly cookie — exposing the token
  // to JavaScript-land would leak it into localStorage via existing cache patterns.
  return {
    data: {
      ...profileData,
      ...(isAndroidClient(event) ? { token } : {})
    }
  };
});

