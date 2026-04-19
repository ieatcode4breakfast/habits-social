export default defineNuxtRouteMiddleware((to, _from) => {
  const user = useSupabaseUser()
  
  if (!user.value && to.path !== '/login') {
    return navigateTo('/login')
  }
})
