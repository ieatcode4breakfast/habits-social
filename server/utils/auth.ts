import { SignJWT, jwtVerify } from 'jose';
import type { H3Event } from 'h3';

const getSecret = (event?: H3Event) => {
  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {}
  
  const secret = (config.jwtSecret as string) || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return new TextEncoder().encode(secret || 'fallback-secret-for-dev');
};

export const generateToken = async (userId: string | number, event: H3Event): Promise<string> => {
  const secret = getSecret(event);
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
};

export const getUserFromEvent = async (event: H3Event): Promise<string | null> => {
  const secret = getSecret(event);
  
  const authHeader = getHeader(event, 'authorization');
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = getCookie(event, 'auth_token');
  }

  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return String(payload.userId);
  } catch {
    return null;
  }
};

export const requireAuth = async (event: H3Event): Promise<string> => {
  const userId = await getUserFromEvent(event);
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  return userId;
};
