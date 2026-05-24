const AUTH_USER_STORAGE_KEY = 'auth-user';

export const useAuth = () => {
  const user = useState<{ id: string; email: string; username: string; photoUrl?: string } | null>('auth-user', () => {
    // Hydrate from localStorage on cold start (client-side only).
    // This prevents false redirects to /login when offline or during SSR hydration gaps.
    if (import.meta.client) {
      try {
        const cached = localStorage.getItem(AUTH_USER_STORAGE_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch { return null; }
    }
    return null;
  });

  const fetchUser = async () => {
    try {
      const headers = useRequestHeaders(['cookie']) as Record<string, string>;
      const { data } = await $fetch<{ data: any }>('/api/auth/me', { headers });
      user.value = data;
      // Persist to localStorage for offline hydration
      if (import.meta.client) {
        if (data) {
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data));
        } else {
          localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }
    } catch (error: any) {
      const status = error?.response?.status || error?.statusCode || error?.status;
      if (status === 401 || status === 403) {
        // Server explicitly rejected the token — clear session state.
        // The auth layer NEVER touches IndexedDB. Only the logout button does.
        user.value = null;
        if (import.meta.client) localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      }
      // Network errors, 500s, timeouts → retain the hydrated state.
      // The user stays on the dashboard with access to their local data.
    }
  };

  return { user, fetchUser };
};
