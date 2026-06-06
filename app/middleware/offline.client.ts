import { buildOfflineRedirect } from '~/utils/offlineRoutes';
import { hasCachedAuthUser } from '~/utils/cachedAuth';

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server && typeof window === 'undefined') return;

  if (navigator.onLine) return;

  const { user } = useAuth();
  const hasSession = Boolean(user.value?.id) || hasCachedAuthUser(localStorage);
  const redirect = buildOfflineRedirect(to.path, hasSession);

  if (redirect && to.fullPath !== redirect) {
    return navigateTo(redirect, { replace: true });
  }
});
