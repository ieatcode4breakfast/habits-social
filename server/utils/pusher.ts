import Pusher from 'pusher';

let pusherInstance: Pusher | null = null;

export function usePusher() {
  if (pusherInstance) {
    return pusherInstance;
  }

  const config = useRuntimeConfig();

  if (!config.pusherAppId || !config.public.pusherKey || !config.pusherSecret || !config.public.pusherCluster) {
    console.warn('Pusher credentials missing. Pusher is disabled.');
    return null;
  }

  pusherInstance = new Pusher({
    appId: config.pusherAppId,
    key: config.public.pusherKey,
    secret: config.pusherSecret,
    cluster: config.public.pusherCluster,
    useTLS: true,
  });

  return pusherInstance;
}
