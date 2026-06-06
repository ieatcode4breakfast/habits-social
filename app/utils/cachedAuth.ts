export const AUTH_USER_STORAGE_KEY = 'auth-user';

type AuthStorage = Pick<Storage, 'getItem'>;

export const hasCachedAuthUser = (storage: AuthStorage): boolean => {
  try {
    const cached = storage.getItem(AUTH_USER_STORAGE_KEY);
    if (!cached) return false;

    const parsed = JSON.parse(cached) as unknown;
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    );
  } catch {
    return false;
  }
};
