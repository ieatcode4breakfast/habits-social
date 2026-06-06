import {
  cacheAuthUser,
  clearCachedAuthUser,
  flushPendingServerLogout,
  getCachedAuthUser,
  hasPendingServerLogout,
  type CachedAuthUser
} from '~/utils/cachedAuth';

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

  const flushPendingLogout = async (): Promise<void> => {
    if (!import.meta.client || !hasPendingServerLogout(localStorage)) return;

    user.value = null;
    clearCachedAuthUser(localStorage);

    if (navigator.onLine) {
      await flushPendingServerLogout(localStorage, (request, options) => $fetch(request, options));
    }
  };

  const fetchUser = async () => {
    if (import.meta.client && hasPendingServerLogout(localStorage)) {
      await flushPendingLogout();
      return;
    }

    try {
      const headers = useRequestHeaders(['cookie']) as Record<string, string>;
      const { data } = await $fetch<{ data: CachedAuthUser | null }>('/api/auth/me', { headers });
      user.value = data;

      if (import.meta.client) {
        if (data) {
          cacheAuthUser(localStorage, data);
        } else {
          clearCachedAuthUser(localStorage);
        }
      }
    } catch (error: unknown) {
      const status = getFetchErrorStatus(error);
      if (status === 401 || status === 403) {
        // Explicit auth rejection clears cached session state. Network errors keep it.
        user.value = null;
        if (import.meta.client) clearCachedAuthUser(localStorage);
      }
    }
  };

  return { user, fetchUser, flushPendingLogout };
};
