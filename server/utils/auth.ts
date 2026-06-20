import { SignJWT, jwtVerify } from 'jose';
import type { H3Event } from 'h3';

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

export const getGoogleClientId = (event?: H3Event): string => {
  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {}

  const cf = (event as any)?.context?.cloudflare;
  const clientId = cf?.env?.NUXT_GOOGLE_CLIENT_ID || cf?.env?.GOOGLE_CLIENT_ID || (config.googleClientId as string) || process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('FATAL: GOOGLE_CLIENT_ID environment variable is missing.');
  }

  return clientId;
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

// Returns both the userId and the raw JWT payload (including iat/exp) for sliding renewal logic
export const getUserAndPayloadFromEvent = async (event: H3Event): Promise<{ userId: string; payload: any } | null> => {
  const secret = getSecret(event);
  
  const authHeader = getHeader(event, 'authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = getCookie(event, AUTH_COOKIE_NAME);
  }

  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: String(payload.userId), payload };
  } catch {
    return null;
  }
};

export const requireAuth = async (event: H3Event): Promise<string> => {
  const userId = await getUserFromEvent(event);
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  return userId;
};

import { createRemoteJWKSet } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let jwksClient: any = null;

export const verifyGoogleIdToken = async (token: string, event: H3Event): Promise<{ email: string; picture?: string; sub: string }> => {
  const clientId = getGoogleClientId(event);

  // Support local offline testing of Google JWT verification
  if (process.env.NODE_ENV === 'test') {
    const secret = getSecret(event);
    const { payload } = await jwtVerify(token, secret);
    if (payload.aud !== clientId) {
      throw new Error('Invalid audience');
    }
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      throw new Error('Invalid issuer');
    }
    return {
      email: payload.email as string,
      picture: payload.picture as string,
      sub: payload.sub as string
    };
  }

  if (!jwksClient) {
    jwksClient = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }

  const { payload } = await jwtVerify(token, jwksClient, {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: clientId,
  });

  if (!payload.email) {
    throw new Error('Google ID Token missing email claim.');
  }

  return {
    email: payload.email as string,
    picture: payload.picture as string,
    sub: payload.sub as string
  };
};

export const generateSignupToken = async (email: string, photoUrl: string | undefined, event: H3Event): Promise<string> => {
  const secret = getSecret(event);
  return await new SignJWT({ email, photoUrl })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
};

export const verifySignupToken = async (token: string, event: H3Event): Promise<{ email: string; photoUrl?: string }> => {
  const secret = getSecret(event);
  const { payload } = await jwtVerify(token, secret);
  return {
    email: payload.email as string,
    photoUrl: payload.photoUrl as string
  };
};

