import Pusher from 'pusher';

let pusherInstance: Pusher | null = null;

export function usePusher(event?: any) {
  if (pusherInstance) {
    return pusherInstance;
  }

  let config;
  try {
    config = useRuntimeConfig(event);
  } catch (e) {
    // In test environments, Nuxt app context might be unavailable.
    // Return null gracefully to allow CRUD operations to continue.
    return null;
  }

  const appId = config?.pusherAppId as string;
  const key = config?.public?.pusherKey as string;
  const secret = config?.pusherSecret as string;
  const cluster = config?.public?.pusherCluster as string;

  if (!appId || !key || !secret || !cluster || appId === 'undefined') {
    return null;
  }

  try {
    pusherInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    return pusherInstance;
  } catch (e) {
    console.error('[Pusher Init Error]:', e);
    return null;
  }
}
