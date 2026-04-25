import { SignJWT, jwtVerify } from 'jose';
import type { H3Event } from 'h3';

const getSecret = () => {
  const config = useRuntimeConfig();
  const secret = config.jwtSecret as string;
  return new TextEncoder().encode(secret);
};

export const generateToken = async (userId: string | number, event: H3Event): Promise<string> => {
  const secret = getSecret();
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
};

export const getUserFromEvent = async (event: H3Event): Promise<string | null> => {
  const secret = getSecret();
  const token = getCookie(event, 'auth_token');
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
