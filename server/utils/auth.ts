import { SignJWT, jwtVerify } from 'jose';
import type { H3Event } from 'h3';

const getSecret = (event: H3Event) => {
  const config = useRuntimeConfig();
  const secret = event.context.cloudflare?.env?.JWT_SECRET || config.jwtSecret as string;
  return new TextEncoder().encode(secret);
};

export const generateToken = async (userId: string | number, event: H3Event): Promise<string> => {
  const secret = getSecret(event);
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
};

export const getUserFromEvent = async (event: H3Event): Promise<number | null> => {
  const secret = getSecret(event);
  const token = getCookie(event, 'auth_token');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return Number(payload.userId);
  } catch {
    return null;
  }
};

export const requireAuth = async (event: H3Event): Promise<number> => {
  const userId = await getUserFromEvent(event);
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  return userId;
};
