import jwt from 'jsonwebtoken';
import type { H3Event } from 'h3';

export const generateToken = (userId: string | number): string => {
  const config = useRuntimeConfig();
  return jwt.sign({ userId }, config.jwtSecret as string, { expiresIn: '7d' });
};

export const getUserFromEvent = (event: H3Event): number | null => {
  const config = useRuntimeConfig();
  const token = getCookie(event, 'auth_token');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret as string) as { userId: string | number };
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
