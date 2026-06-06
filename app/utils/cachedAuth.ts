export const AUTH_USER_STORAGE_KEY = 'auth-user';

type AuthStorage = Pick<Storage, 'getItem'>;

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
