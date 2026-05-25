import { eq, sql } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { 
  generateToken as _generateToken, 
  setAuthCookie as _setAuthCookie, 
  verifyGoogleIdToken, 
  generateSignupToken 
} from '~~/server/utils/auth';
import { checkRateLimit, resetRateLimit } from '~~/server/utils/rateLimit';
import { z } from 'zod';

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const setAuthCookie = (event.context as any).setAuthCookie || _setAuthCookie;
  const db = useDB(event);

  const body = await readBody(event);
  const validation = googleAuthSchema.safeParse(body);

  if (!validation.success) {
    throw createError({ statusCode: 400, statusMessage: validation.error.issues[0]?.message || 'Invalid request' });
  }

  const { credential } = validation.data;

  // Verify the Google ID Token
  let email: string;
  let picture: string | undefined;
  try {
    const verified = await verifyGoogleIdToken(credential, event);
    email = verified.email;
    picture = process.env.NODE_ENV === 'test' ? verified.picture : undefined;
  } catch (err: any) {
    throw createError({ statusCode: 401, statusMessage: err.message || 'Unauthorized: Invalid Google credential' });
  }

  // Rate limit check based on email
  await checkRateLimit(event, email);

  // Look up user by lowercased email
  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl,
    emailVerifiedAt: users.emailVerifiedAt,
  })
  .from(users)
  .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
  .limit(1);

  const user = results[0];

  if (user) {
    // Auto-verify email if not verified yet
    if (!user.emailVerifiedAt) {
      await db.update(users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    // User already exists - log them in immediately
    const token = await generateToken(user.id, event);
    await resetRateLimit(event, email);
    setAuthCookie(event, token);

    return {
      data: {
        signupRequired: false,
        token,
        id: user.id,
        email: user.email,
        username: user.username,
        photoUrl: user.photoUrl
      }
    };
  }

  // User does not exist - generate temporary sign-up token
  const signupToken = await generateSignupToken(email, picture, event);
  await resetRateLimit(event, email);

  return {
    data: {
      signupRequired: true,
      signupToken,
      email,
      photoUrl: picture
    }
  };
});
