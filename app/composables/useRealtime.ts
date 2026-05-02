import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export const useRealtime = () => {
  const config = useRuntimeConfig();
  const { user } = useAuth();
  
  if (import.meta.client && !pusherInstance && config.public.pusherKey && config.public.pusherCluster) {

    pusherInstance = new Pusher(config.public.pusherKey as string, {
      cluster: config.public.pusherCluster as string,
    });
  }

  const subscribeToSocials = (callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance || !user.value?.id) return () => {};
    
    const channelName = `user-${user.value.id}-social`;

    const channel = pusherInstance.subscribe(channelName);
    
    const onReceived = (data: any) => callback('friend-request-received', data);
    const onAccepted = (data: any) => callback('friend-request-accepted', data);
    const onRemoved = (data: any) => callback('friendship-removed', data);

    channel.bind('friend-request-received', onReceived);
    channel.bind('friend-request-accepted', onAccepted);
    channel.bind('friendship-removed', onRemoved);

    return () => {

      channel.unbind('friend-request-received', onReceived);
      channel.unbind('friend-request-accepted', onAccepted);
      channel.unbind('friendship-removed', onRemoved);
      
      // We don't unsubscribe here because other components might still be using the channel
      // Pusher will automatically clean up unused channels.
    };
  };

  const subscribeToUserSync = (userId: string, callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance) return () => {};
    
    const habitsChannelName = `user-${userId}-habits`;
    const bucketsChannelName = `user-${userId}-buckets`;

    const habitsChannel = pusherInstance.subscribe(habitsChannelName);
    const bucketsChannel = pusherInstance.subscribe(bucketsChannelName);
    
    const onSyncSettled = (data: any) => callback('sync-settled', data);

    habitsChannel.bind('sync-settled', onSyncSettled);
    bucketsChannel.bind('sync-settled', onSyncSettled);

    return () => {
      habitsChannel.unbind('sync-settled', onSyncSettled);
      bucketsChannel.unbind('sync-settled', onSyncSettled);
    };
  };

  const subscribeToUserBuckets = (userId: string, callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance) return () => {};
    
    const channelName = `user-${userId}-buckets`;
    const channel = pusherInstance.subscribe(channelName);
    
    const onUpdated = (data: any) => callback('bucket-updated', data);
    const onDeleted = (data: any) => callback('bucket-deleted', data);
    const onRefresh = (data: any) => callback('bucket-needs-refresh', data);
    const onSyncSettled = (data: any) => callback('sync-settled', data);

    channel.bind('bucket-updated', onUpdated);
    channel.bind('bucket-deleted', onDeleted);
    channel.bind('bucket-needs-refresh', onRefresh);
    channel.bind('sync-settled', onSyncSettled);

    return () => {
      channel.unbind('bucket-updated', onUpdated);
      channel.unbind('bucket-deleted', onDeleted);
      channel.unbind('bucket-needs-refresh', onRefresh);
      channel.unbind('sync-settled', onSyncSettled);
    };
  };

  const subscribeToFriendHabits = (friendId: string, callback: (eventName: string, data: any) => void) => {
    if (!pusherInstance) return () => {};
    
    const channelName = `user-${friendId}-habits`;

    const channel = pusherInstance.subscribe(channelName);
    
    // We still allow friends to listen to specific legacy updates if needed for UI,
    // but the main data sync will use 'sync-settled'
    const onUpdated = (data: any) => callback('habit-updated', data);
    const onDeleted = (data: any) => callback('habit-deleted', data);
    const onSyncSettled = (data: any) => callback('sync-settled', data);

    channel.bind('habit-updated', onUpdated);
    channel.bind('habit-deleted', onDeleted);
    channel.bind('sync-settled', onSyncSettled);

    return () => {

      channel.unbind('habit-updated', onUpdated);
      channel.unbind('habit-deleted', onDeleted);
      channel.unbind('sync-settled', onSyncSettled);
    };
  };

  return {
    pusher: pusherInstance,
    subscribeToSocials,
    subscribeToUserSync,
    subscribeToUserBuckets,
    subscribeToFriendHabits
  };
};
