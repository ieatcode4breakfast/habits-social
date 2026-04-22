import jwt from 'jsonwebtoken';
import { H3Event, getCookie } from 'h3';

export const generateToken = (userId: string) => {
  const config = useRuntimeConfig();
  return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: '7d' });
};

export const verifyToken = (token: string) => {
  const config = useRuntimeConfig();
  try {
    return jwt.verify(token, config.jwtSecret) as { id: string };
  } catch (error) {
    return null;
  }
};

export const getUserFromEvent = (event: H3Event) => {
  const token = getCookie(event, 'auth_token');
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded ? decoded.id : null;
};

export const requireAuth = (event: H3Event) => {
  const userId = getUserFromEvent(event);
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  return userId;
};
