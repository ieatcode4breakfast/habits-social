import offlineClientMiddleware from './offline.client';

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return;
  return offlineClientMiddleware(to, from);
});
