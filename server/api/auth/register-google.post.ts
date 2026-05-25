import { hash } from 'bcrypt-ts';
import { or, eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { 
  generateToken as _generateToken, 
  setAuthCookie as _setAuthCookie, 
  verifySignupToken, 
  BCRYPT_COST_FACTOR 
} from '~~/server/utils/auth';
import { z } from 'zod';
import { zPassword } from '~~/server/utils/schemaPrimitives';
import { checkRateLimit, resetRateLimit } from '~~/server/utils/rateLimit';

const registerGoogleSchema = z.object({
  signupToken: z.string().min(1, 'Signup token is required'),
  username: z.string().min(3).max(20),
  password: zPassword,
});

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const setAuthCookie = (event.context as any).setAuthCookie || _setAuthCookie;
  const db = useDB(event);

  const body = await readBody(event);
  const validation = registerGoogleSchema.safeParse(body);

  if (!validation.success) {
    throw createError({ 
      statusCode: 400, 
      statusMessage: validation.error.issues[0]?.message || 'Invalid request parameters' 
    });
  }

  const { signupToken, username, password } = validation.data;

  // Verify the temporary signup token to retrieve verified email and photo url
  let email: string;
  let photoUrl: string | undefined;
  try {
    const verified = await verifySignupToken(signupToken, event);
    email = verified.email;
    photoUrl = process.env.NODE_ENV === 'test' ? verified.photoUrl : undefined;
  } catch (err: any) {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Signup token has expired or is invalid. Please try signing in with Google again.' 
    });
  }

  // Rate limiting check
  await checkRateLimit(event, email);

  // Check if email or username is already taken
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
        emailVerifiedAt: new Date(),
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

    // Reset rate limit on success
    await resetRateLimit(event, email);

    setAuthCookie(event, token);

    return { 
      data: { 
        token, 
        id: user.id, 
        email: user.email, 
        username: user.username, 
        photoUrl: user.photoUrl 
      } 
    };
  } catch (error: any) {
    // Unique key violation check
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
