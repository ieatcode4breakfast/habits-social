import { ref, onMounted, onUnmounted } from 'vue';
import { useRealtime } from './useRealtime';

export interface SocialNotificationOptions {
  onFriendRequestReceived?: (data: any) => void;
  onFriendRequestAccepted?: (data: any) => void;
  onFriendshipRemoved?: (data: any) => void;
}

export const useSocialNotifications = (options?: SocialNotificationOptions) => {
  const pendingCount = useState('pendingRequestsCount', () => 0);
  const { user } = useAuth();
  const { subscribeToSocials } = useRealtime();
  let unsubscribe: (() => void) | null = null;

  const refreshCount = async () => {
    if (!user.value) return;
    try {
      const data = await $fetch<{ friendships: any[] }>('/api/social/friends');
      const myId = String(user.value.id);
      pendingCount.value = data.friendships.filter((f: any) => f.status === 'pending' && String(f.receiverId) === myId).length;
    } catch (e) {
      console.error('Failed to fetch social notifications', e);
    }
  };

  const init = () => {
    if (import.meta.server) return;
    
    refreshCount();
    
    unsubscribe = subscribeToSocials((eventName, data) => {
      refreshCount();
      if (eventName === 'friend-request-received' && options?.onFriendRequestReceived) options.onFriendRequestReceived(data);
      if (eventName === 'friend-request-accepted' && options?.onFriendRequestAccepted) options.onFriendRequestAccepted(data);
      if (eventName === 'friendship-removed' && options?.onFriendshipRemoved) options.onFriendshipRemoved(data);
    });
  };

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  return {
    pendingCount,
    refreshCount,
    init,
    cleanup
  };
};
