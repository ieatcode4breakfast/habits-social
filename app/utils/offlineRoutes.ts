export type OfflineUnavailableReason = 'route' | 'session';

export const OFFLINE_ALLOWED_PATHS = ['/', '/habits', '/buckets', '/offline'] as const;

export const isOfflineAccessibleRoute = (path: string): boolean => {
  const cleanPath = path.split(/[?#]/)[0] || '';
  return (OFFLINE_ALLOWED_PATHS as readonly string[]).includes(cleanPath);
};

export const buildOfflineRedirect = (
  path: string,
  hasCachedUser: boolean
): string | null => {
  const cleanPath = path.split(/[?#]/)[0] || '';

  if (!hasCachedUser) {
    if (cleanPath === '/offline') {
      return null;
    }
    return '/offline?reason=session';
  }

  if (isOfflineAccessibleRoute(path)) {
    return null;
  }

  return `/offline?from=${encodeURIComponent(path)}`;
};
