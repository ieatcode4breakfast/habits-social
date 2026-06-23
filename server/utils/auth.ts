import { SignJWT, jwtVerify } from 'jose';
import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { useDB } from './db';

export const BCRYPT_COST_FACTOR = 10;
export const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgNIhp.pX7wMQRpM64ls7ZSXH0uz';

export const AUTH_COOKIE_NAME = 'auth_token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_EXPIRATION_JWT = `${SESSION_MAX_AGE_SECONDS / 86400}d`;

const getSecret = (event?: H3Event) => {
  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {}

  const cf = (event as any)?.context?.cloudflare;
  const secret = cf?.env?.NUXT_JWT_SECRET || cf?.env?.JWT_SECRET || (config.jwtSecret as string) || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return new TextEncoder().encode(secret);
};

export const generateToken = async (userId: string | number, event: H3Event, sessionVersion = 1): Promise<string> => {
  const secret = getSecret(event);
  return await new SignJWT({ userId, sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION_JWT)
    .sign(secret);
};

export const setAuthCookie = (event: H3Event, token: string) => {
  setCookie(event, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
  });
};

export const getUserFromEvent = async (event: H3Event): Promise<string | null> => {
  const result = await getUserAndPayloadFromEvent(event);
  return result ? result.userId : null;
};

// Returns both the userId and the raw JWT payload (including iat/exp/sessionVersion) for sliding renewal logic.
// Strict Authorization parsing: if the Authorization header is present but malformed
// (not exactly "Bearer <non-empty-token>"), the request is rejected without falling back to cookie auth.
// This defends against clients sending garbage Authorization headers that would otherwise silently degrade.
export const getUserAndPayloadFromEvent = async (event: H3Event): Promise<{ userId: string; payload: any } | null> => {
  const secret = getSecret(event);

  const authHeader = getHeader(event, 'authorization');
  let token: string | null = null;

  if (authHeader !== undefined && authHeader !== null) {
    // Authorization header present — must be exactly "Bearer <non-empty-token>"
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return null; // malformed: fail closed, no cookie fallback
    }
    const extracted = authHeader.substring(7).trim();
    if (extracted.length === 0) {
      return null; // empty token: fail closed, no cookie fallback
    }
    token = extracted;
  } else {
    // No Authorization header — fall back to cookie auth (web/PWA)
    token = getCookie(event, AUTH_COOKIE_NAME) ?? null;
  }

  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: String(payload.userId), payload };
  } catch {
    return null;
  }
};

/**
 * Authenticate the request and enforce session-version revocation.
 *
 * Unlike the previous version, this loads the user's current sessionVersion from the database
 * and rejects the request if the JWT's sessionVersion does not match. This means logging out
 * (which increments sessionVersion) immediately invalidates ALL existing JWTs across every
 * protected endpoint — not just `/api/auth/me`.
 */
export const requireAuth = async (event: H3Event): Promise<string> => {
  const result = await getUserAndPayloadFromEvent(event);
  if (!result) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });

  const { userId, payload } = result;
  const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 1;

  // Verify the session version is still current.
  // This turns logout into a global session revocation mechanism.
  const db = useDB(event);
  const userRows = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId));

  const user = userRows[0];
  if (!user || tokenSessionVersion !== user.sessionVersion) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  return userId;
};

