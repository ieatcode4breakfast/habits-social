import jwt from 'jsonwebtoken';
import type { H3Event } from 'h3';

const getSecret = (event: H3Event) => {
  const config = useRuntimeConfig();
  // Prefer the Cloudflare env variable directly, then fallback to runtimeConfig
  return event.context.cloudflare?.env?.JWT_SECRET || config.jwtSecret as string;
};

export const generateToken = (userId: string | number, event: H3Event): string => {
  const secret = getSecret(event);
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

export const getUserFromEvent = (event: H3Event): number | null => {
  const secret = getSecret(event);
  const token = getCookie(event, 'auth_token');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, secret) as { userId: string | number };
    return Number(decoded.userId);
  } catch {
    return null;
  }
};

export const requireAuth = (event: H3Event): number => {
  const userId = getUserFromEvent(event);
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  return userId;
};
