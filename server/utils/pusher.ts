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

  const cf = event?.context?.cloudflare;
  
  const appId = config?.pusherAppId as string 
    || cf?.env?.PUSHER_APP_ID 
    || cf?.env?.NUXT_PUSHER_APP_ID;
    
  const key = config?.public?.pusherKey as string 
    || cf?.env?.PUSHER_KEY 
    || cf?.env?.NUXT_PUBLIC_PUSHER_KEY;
    
  const secret = config?.pusherSecret as string 
    || cf?.env?.PUSHER_SECRET 
    || cf?.env?.NUXT_PUSHER_SECRET;
    
  const cluster = config?.public?.pusherCluster as string 
    || cf?.env?.PUSHER_CLUSTER 
    || cf?.env?.NUXT_PUBLIC_PUSHER_CLUSTER;

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
