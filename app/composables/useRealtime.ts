import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export const useRealtime = () => {
  const config = useRuntimeConfig();
  const { user } = useAuth(); // assuming user auth gives us the user id
  
  if (!pusherInstance && config.public.pusherKey && config.public.pusherCluster) {
    pusherInstance = new Pusher(config.public.pusherKey, {
      cluster: config.public.pusherCluster,
    });
  }

  const subscribeToSocials = (callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance || !user.value?.id) return () => {};
    
    const channelName = `user-${user.value.id}-social`;
    const channel = pusherInstance.subscribe(channelName);
    
    channel.bind('friend-request-received', (data: any) => callback('friend-request-received', data));
    channel.bind('friend-request-accepted', (data: any) => callback('friend-request-accepted', data));
    channel.bind('friendship-removed', (data: any) => callback('friendship-removed', data));

    return () => {
      pusherInstance?.unsubscribe(channelName);
    };
  };

  const subscribeToFriendHabits = (friendId: string, callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance) return () => {};
    
    const channelName = `user-${friendId}-habits`;
    const channel = pusherInstance.subscribe(channelName);
    
    channel.bind('habit-updated', (data: any) => callback('habit-updated', data));
    channel.bind('habit-deleted', (data: any) => callback('habit-deleted', data));

    return () => {
      pusherInstance?.unsubscribe(channelName);
    };
  };

  return {
    pusher: pusherInstance,
    subscribeToSocials,
    subscribeToFriendHabits
  };
};
