import { AUTH_USER_STORAGE_KEY, getCachedAuthUser, type CachedAuthUser } from '~/utils/cachedAuth';

const getFetchErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) return null;

  const maybeError = error as {
    response?: { status?: unknown };
    statusCode?: unknown;
    status?: unknown;
  };
  const status = maybeError.response?.status ?? maybeError.statusCode ?? maybeError.status;
  return typeof status === 'number' ? status : null;
};

export const useAuth = () => {
  const user = useState<CachedAuthUser | null>('auth-user', () => {
    if (import.meta.client) {
      return getCachedAuthUser(localStorage);
    }
    return null;
  });

  if (import.meta.client && !user.value) {
    user.value = getCachedAuthUser(localStorage);
  }

  const fetchUser = async () => {
    try {
      const headers = useRequestHeaders(['cookie']) as Record<string, string>;
      const { data } = await $fetch<{ data: CachedAuthUser | null }>('/api/auth/me', { headers });
      user.value = data;

      if (import.meta.client) {
        if (data) {
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data));
        } else {
          localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }
    } catch (error: unknown) {
      const status = getFetchErrorStatus(error);
      if (status === 401 || status === 403) {
        // Explicit auth rejection clears cached session state. Network errors keep it.
        user.value = null;
        if (import.meta.client) localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      }
    }
  };

  return { user, fetchUser };
};
