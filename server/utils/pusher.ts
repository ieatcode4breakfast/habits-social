import Pusher from 'pusher';

let pusherInstance: Pusher | null = null;

export function usePusher(event?: any) {
  if (pusherInstance) {
    return pusherInstance;
  }

  const config = useRuntimeConfig(event);
  const cf = event?.context?.cloudflare;

  const appId = (config.pusherAppId as string) || (process as any)?.env?.PUSHER_APP_ID || cf?.env?.PUSHER_APP_ID;
  const key = (config.public.pusherKey as string) || (process as any)?.env?.PUSHER_KEY || cf?.env?.PUSHER_KEY;
  const secret = (config.pusherSecret as string) || (process as any)?.env?.PUSHER_SECRET || cf?.env?.PUSHER_SECRET;
  const cluster = (config.public.pusherCluster as string) || (process as any)?.env?.PUSHER_CLUSTER || cf?.env?.PUSHER_CLUSTER;

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
