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
  
  const appId = cf?.env?.PUSHER_APP_ID 
    || cf?.env?.NUXT_PUSHER_APP_ID
    || config?.pusherAppId as string;
    
  const key = cf?.env?.PUSHER_KEY 
    || cf?.env?.NUXT_PUBLIC_PUSHER_KEY
    || config?.public?.pusherKey as string;
    
  const secret = cf?.env?.PUSHER_SECRET 
    || cf?.env?.NUXT_PUSHER_SECRET
    || config?.pusherSecret as string;
    
  const cluster = cf?.env?.PUSHER_CLUSTER 
    || cf?.env?.NUXT_PUBLIC_PUSHER_CLUSTER
    || config?.public?.pusherCluster as string;

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
