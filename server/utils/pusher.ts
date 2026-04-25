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
    appId: config.pusherAppId as string,
    key: config.public.pusherKey as string,
    secret: config.pusherSecret as string,
    cluster: config.public.pusherCluster as string,
    useTLS: true,
  });

  return pusherInstance;
}
