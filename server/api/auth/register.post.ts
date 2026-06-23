import { hash } from 'bcrypt-ts';
import { or, eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { generateToken as _generateToken, setAuthCookie as _setAuthCookie, BCRYPT_COST_FACTOR } from '~~/server/utils/auth';
import { registerSchema, throwZodError } from '~~/server/utils/validation';
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
  const validation = registerSchema.safeParse(body);
  
  if (!validation.success) {
    return throwZodError(validation.error);
  }

  const { email, password, username, photoUrl } = validation.data;

  // Rate limiting check (using email as identifier)
  await checkRateLimit(event, email);

  const existingUser = await db.select({ id: users.id })
    .from(users)
    .where(or(
      eq(sql`lower(${users.email})`, email.toLowerCase()),
      eq(sql`lower(${users.username})`, username.toLowerCase())
    ))
    .limit(1);

  if (existingUser.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email or username already taken' });
  }

  const passwordHash = await hash(password, BCRYPT_COST_FACTOR);

  try {
    const result = await db.insert(users)
      .values({
        id: crypto.randomUUID(),
        email,
        username,
        passwordHash,
        photoUrl: photoUrl || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        photoUrl: users.photoUrl
      });

    if (result.length === 0) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create user' });
    }

    const user = result[0];
    const token = await generateToken(user.id, event);

    // Success: Reset identifier rate limit
    await resetRateLimit(event, email);

    // Always set the web cookie
    setAuthCookie(event, token);

    const profileData = {
      id: user.id,
      email: user.email,
      username: user.username,
      photoUrl: user.photoUrl
    };

    // Only include the raw token for Android native clients (Keystore storage).
    return {
      data: {
        ...profileData,
        ...(isAndroidClient(event) ? { token } : {})
      }
    };
  } catch (error: any) {
    // Catch PostgreSQL unique violation (code 23505) or Neon wrapper errors
    if (error.code === '23505' || 
        error.message?.toLowerCase().includes('unique') || 
        error.message?.toLowerCase().includes('duplicate') ||
        error.cause?.message?.toLowerCase().includes('unique') ||
        error.cause?.message?.toLowerCase().includes('duplicate')) {
      throw createError({ statusCode: 409, statusMessage: 'Email or username already taken' });
    }
    throw error;
  }
});

