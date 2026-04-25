export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth();

  // On initial load or refresh, ensure we've checked the session
  if (!user.value) {
    await fetchUser();
  }

  if (!user.value && to.path !== '/login') {
    return navigateTo('/login');
  }

  if (user.value && to.path === '/login') {
    return navigateTo('/');
  }
});
