export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth();
  const publicAuthPaths = ['/login', '/forgot-password', '/reset-password'];

  // On initial load or refresh, ensure we've checked the session
  if (!user.value) {
    await fetchUser();
  }

  if (!user.value && !publicAuthPaths.includes(to.path)) {
    return navigateTo('/login');
  }

  if (user.value && publicAuthPaths.includes(to.path)) {
    return navigateTo('/habits');
  }
});
