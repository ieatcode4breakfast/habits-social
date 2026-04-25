import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export const useRealtime = () => {
  const config = useRuntimeConfig();
  const { user } = useAuth();
  
  if (import.meta.client && !pusherInstance && config.public.pusherKey && config.public.pusherCluster) {
    console.log('[Realtime] Initializing Pusher...');
    pusherInstance = new Pusher(config.public.pusherKey as string, {
      cluster: config.public.pusherCluster as string,
    });
  }

  const subscribeToSocials = (callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance || !user.value?.id) return () => {};
    
    const channelName = `user-${user.value.id}-social`;
    console.log('[Realtime] Subscribing to social channel:', channelName);
    const channel = pusherInstance.subscribe(channelName);
    
    const onReceived = (data: any) => callback('friend-request-received', data);
    const onAccepted = (data: any) => callback('friend-request-accepted', data);
    const onRemoved = (data: any) => callback('friendship-removed', data);

    channel.bind('friend-request-received', onReceived);
    channel.bind('friend-request-accepted', onAccepted);
    channel.bind('friendship-removed', onRemoved);

    return () => {
      console.log('[Realtime] Unbinding social listeners from:', channelName);
      channel.unbind('friend-request-received', onReceived);
      channel.unbind('friend-request-accepted', onAccepted);
      channel.unbind('friendship-removed', onRemoved);
      
      // We don't unsubscribe here because other components might still be using the channel
      // Pusher will automatically clean up unused channels.
    };
  };

  const subscribeToFriendHabits = (friendId: string, callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance) return () => {};
    
    const channelName = `user-${friendId}-habits`;
    console.log('[Realtime] Subscribing to habits channel:', channelName);
    const channel = pusherInstance.subscribe(channelName);
    
    const onUpdated = (data: any) => callback('habit-updated', data);
    const onDeleted = (data: any) => callback('habit-deleted', data);

    channel.bind('habit-updated', onUpdated);
    channel.bind('habit-deleted', onDeleted);

    return () => {
      console.log('[Realtime] Unbinding habit listeners from:', channelName);
      channel.unbind('habit-updated', onUpdated);
      channel.unbind('habit-deleted', onDeleted);
    };
  };

  return {
    pusher: pusherInstance,
    subscribeToSocials,
    subscribeToFriendHabits
  };
};
