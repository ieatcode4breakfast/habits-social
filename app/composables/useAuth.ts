import {
  cacheAuthUser,
  clearCachedAuthUser,
  flushPendingServerLogout,
  getCachedAuthUser,
  hasPendingServerLogout,
  type CachedAuthUser
} from '~/utils/cachedAuth';
import { habitsApi } from '~/utils/apiClient';
import { setNativeAuthToken, clearNativeAuthToken } from '~/utils/nativeAuthToken';

const getFetchErrorStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) return null;

  const maybeError = error as {
    response?: { status?: unknown; statusCode?: unknown };
    statusCode?: unknown;
    status?: unknown;
  };
  const status = maybeError.response?.status ?? maybeError.response?.statusCode ?? maybeError.statusCode ?? maybeError.status;
  return typeof status === 'number' ? status : null;
};

const isNetworkOrFetchFailure = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as {
    name?: string;
    message?: string;
    response?: unknown;
  };

  const name = err.name || '';
  const message = err.message || '';

  if (name === 'FetchError') {
    return !err.response;
  }

  if (name === 'TypeError') {
    const lowerMsg = message.toLowerCase();
    return (
      lowerMsg.includes('fetch') ||
      lowerMsg.includes('network') ||
      lowerMsg.includes('load failed') ||
      lowerMsg.includes('unreachable')
    );
  }

  return false;
};

interface AuthMeResponse {
  data: (CachedAuthUser & { token?: string }) | null;
}

export const useAuth = () => {
  const user = useState<CachedAuthUser | null>('auth-user', () => null);

  const flushPendingLogout = async (): Promise<void> => {
    if (!import.meta.client || !hasPendingServerLogout(localStorage)) return;

    user.value = null;
    clearCachedAuthUser(localStorage);

    if (navigator.onLine) {
      await flushPendingServerLogout(localStorage, (request, options) =>
        habitsApi(request, { method: options.method, timeout: options.timeout, authRequired: false })
      );
    }
  };

  const fetchUser = async () => {
    if (import.meta.client && hasPendingServerLogout(localStorage)) {
      await flushPendingLogout();
      return;
    }

    try {
      const response = await habitsApi<AuthMeResponse>('/api/auth/me');
      const data = response.data;

      // On Android: if the server returned a renewed token, update secure storage.
      if (data?.token) {
        await setNativeAuthToken(data.token);
      }

      // Sanitize: only cache profile fields, never the raw token.
      const profile: CachedAuthUser | null = data
        ? {
            id: data.id,
            email: data.email,
            username: data.username,
            ...(data.photoUrl ? { photoUrl: data.photoUrl } : {})
          }
        : null;

      user.value = profile;

      if (import.meta.client) {
        if (profile) {
          cacheAuthUser(localStorage, profile);
        } else {
          clearCachedAuthUser(localStorage);
        }
      }
    } catch (error: unknown) {
      const status = getFetchErrorStatus(error);
      if (status === 401 || status === 403) {
        // Explicit auth rejection clears cached session state AND native secure token.
        user.value = null;
        if (import.meta.client) {
          clearCachedAuthUser(localStorage);
          void clearNativeAuthToken();
        }
      } else if (
        status === null &&
        import.meta.client &&
        (!navigator.onLine || isNetworkOrFetchFailure(error)) &&
        !user.value
      ) {
        // Fallback to cached session only under true offline/network failure
        user.value = getCachedAuthUser(localStorage);
      }
    }
  };

  return { user, fetchUser, flushPendingLogout };
};
