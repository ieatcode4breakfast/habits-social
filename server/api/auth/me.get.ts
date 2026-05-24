import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { getUserAndPayloadFromEvent as _getUserAndPayloadFromEvent, generateToken as _generateToken, setAuthCookie as _setAuthCookie } from '~~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const getUserAndPayloadFromEvent = (event.context as any).getUserAndPayloadFromEvent || _getUserAndPayloadFromEvent;
  const generateToken = (event.context as any).generateToken || _generateToken;
  const setAuthCookie = (event.context as any).setAuthCookie || _setAuthCookie;
  const db = useDB(event);

  const authResult = await getUserAndPayloadFromEvent(event);

  if (!authResult) {
    return { data: null };
  }

  const { userId, payload } = authResult;

  const results = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    photoUrl: users.photoUrl
  })
  .from(users)
  .where(eq(users.id, userId));

  const user = results[0];

  if (!user) {
    deleteCookie(event, 'auth_token');
    return { data: null };
  }

  // Sliding session renewal: only issue a new token if the current one
  // has consumed more than 50% of its total lifetime.
  if (payload.iat && payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = payload.iat as number;
    const expiresAt = payload.exp as number;
    const totalLifetime = expiresAt - issuedAt;
    const elapsed = now - issuedAt;

    if (elapsed > totalLifetime / 2) {
      const newToken = await generateToken(userId, event);
      setAuthCookie(event, newToken);
    }
  }

  return { data: user };
});
