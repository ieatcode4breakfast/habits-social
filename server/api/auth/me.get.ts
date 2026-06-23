import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { useDB as _useDB } from '~~/server/utils/db';
import { AUTH_COOKIE_NAME, getUserAndPayloadFromEvent as _getUserAndPayloadFromEvent, generateToken as _generateToken, setAuthCookie as _setAuthCookie } from '~~/server/utils/auth';

// ponytail: single-line client header check; upgrade path: version matrix if more clients appear
const isAndroidClient = (event: { node?: { req?: { headers?: Record<string, string | string[] | undefined> } } }): boolean => {
  const clientHeader = getHeader(event as any, 'x-habits-client');
  return typeof clientHeader === 'string' && clientHeader.toLowerCase() === 'android/1.7.0';
};

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
    photoUrl: users.photoUrl,
    sessionVersion: users.sessionVersion
  })
  .from(users)
  .where(eq(users.id, userId));

  const user = results[0];

  if (!user) {
    deleteCookie(event, AUTH_COOKIE_NAME);
    return { data: null };
  }

  const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 1;
  if (tokenSessionVersion !== user.sessionVersion) {
    deleteCookie(event, AUTH_COOKIE_NAME);
    return { data: null };
  }

  // Sliding session renewal: only issue a new token if the current one
  // has consumed more than 50% of its total lifetime.
  let renewedToken: string | null = null;
  if (payload.iat && payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = payload.iat as number;
    const expiresAt = payload.exp as number;
    const totalLifetime = expiresAt - issuedAt;
    const elapsed = now - issuedAt;

    if (elapsed > totalLifetime / 2) {
      renewedToken = await generateToken(userId, event, user.sessionVersion);
      // Always refresh the cookie for web clients
      setAuthCookie(event, renewedToken);
    }
  }

  const profileData = {
    id: user.id,
    email: user.email,
    username: user.username,
    photoUrl: user.photoUrl
  };

  // Only include the renewed token for Android native clients (Keystore storage update).
  // Web/PWA clients get the renewed session via the Set-Cookie header.
  const androidClient = isAndroidClient(event);

  return {
    data: {
      ...profileData,
      ...(androidClient && renewedToken ? { token: renewedToken } : {})
    }
  };
});
