export const AUTH_USER_STORAGE_KEY = 'auth-user';
export const AUTH_PENDING_SERVER_LOGOUT_KEY = 'auth-pending-server-logout';

type AuthStorage = Pick<Storage, 'getItem'>;
type MutableAuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type LogoutFetcher = (
  request: string,
  options: { method: 'POST'; timeout?: number }
) => Promise<unknown>;

export interface CachedAuthUser {
  id: string;
  email: string;
  username: string;
  photoUrl?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const getCachedAuthUser = (storage: AuthStorage): CachedAuthUser | null => {
  try {
    if (hasPendingServerLogout(storage)) return null;

    const cached = storage.getItem(AUTH_USER_STORAGE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as unknown;
    if (!isRecord(parsed)) return null;

    const { id, email, username, photoUrl } = parsed;
    if (typeof id !== 'string' || id.length === 0) return null;
    if (typeof email !== 'string') return null;
    if (typeof username !== 'string') return null;
    if (photoUrl !== undefined && typeof photoUrl !== 'string') return null;

    return {
      id,
      email,
      username,
      ...(photoUrl ? { photoUrl } : {})
    };
  } catch {
    return null;
  }
};

export const hasCachedAuthUser = (storage: AuthStorage): boolean => {
  return getCachedAuthUser(storage) !== null;
};

export const cacheAuthUser = (storage: MutableAuthStorage, user: CachedAuthUser): void => {
  storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  clearPendingServerLogout(storage);
};

export const clearCachedAuthUser = (storage: Pick<Storage, 'removeItem'>): void => {
  storage.removeItem(AUTH_USER_STORAGE_KEY);
};

export const hasPendingServerLogout = (storage: AuthStorage): boolean => {
  return storage.getItem(AUTH_PENDING_SERVER_LOGOUT_KEY) !== null;
};

export const markPendingServerLogout = (storage: Pick<Storage, 'setItem'>): void => {
  storage.setItem(AUTH_PENDING_SERVER_LOGOUT_KEY, String(Date.now()));
};

export const clearPendingServerLogout = (storage: Pick<Storage, 'removeItem'>): void => {
  storage.removeItem(AUTH_PENDING_SERVER_LOGOUT_KEY);
};

export const flushPendingServerLogout = async (
  storage: MutableAuthStorage,
  fetcher: LogoutFetcher,
  timeoutMs = 3000
): Promise<boolean> => {
  if (!hasPendingServerLogout(storage)) return true;

  try {
    await fetcher('/api/auth/logout', { method: 'POST', timeout: timeoutMs });
    clearPendingServerLogout(storage);
    return true;
  } catch {
    return false;
  }
};
