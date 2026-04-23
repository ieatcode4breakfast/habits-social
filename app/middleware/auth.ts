export default defineNuxtRouteMiddleware((to) => {
  const { user } = useAuth();
  if (!user.value && to.path !== '/login') {
    return navigateTo('/login');
  }
});
