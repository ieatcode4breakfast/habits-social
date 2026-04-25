import { ref, computed } from 'vue';
import { useRealtime } from './useRealtime';

export interface UserProfile { 
  id: string; 
  email: string; 
  username: string; 
  photourl?: string; 
}

export interface Friendship { 
  id: string; 
  participants: string[]; 
  initiatorId: string; 
  receiverId: string; 
  status: 'pending' | 'accepted'; 
}

export const useSocial = () => {
  const { user } = useAuth();
  const { subscribeToSocials } = useRealtime();

  // Global state using Nuxt's useState
  const friendships = useState<Friendship[]>('social-friendships', () => []);
  const profiles = useState<UserProfile[]>('social-profiles', () => []);
  const pendingCount = useState<number>('social-pending-count', () => 0);
  const isLoading = useState<boolean>('social-loading', () => false);

  // Derived state
  const friends = computed(() => {
    if (!user.value?.id) return [];
    const myId = String(user.value.id);
    
    return friendships.value
      .filter(f => f.status === 'accepted')
      .map(f => {
        const friendId = f.participants.find(p => String(p) !== myId);
        return profiles.value.find(p => String(p.id) === String(friendId));
      })
      .filter((p): p is UserProfile => !!p);
  });

  const profilesMap = computed(() => {
    const map: Record<string, UserProfile> = {};
    profiles.value.forEach(p => {
      map[p.id] = p;
    });
    return map;
  });

  const refresh = async () => {
    if (!user.value) return;
    isLoading.value = true;
    try {
      const data = await $fetch<{ friendships: Friendship[]; profiles: UserProfile[] }>('/api/social/friends');
      friendships.value = data.friendships;
      profiles.value = data.profiles;
      
      // Update pending count (incoming only)
      const myId = String(user.value.id);
      pendingCount.value = data.friendships.filter(
        f => f.status === 'pending' && String(f.receiverId) === myId
      ).length;
    } catch (e) {
      console.error('[Social] Failed to refresh social data', e);
    } finally {
      isLoading.value = false;
    }
  };

  let unsubscribe: (() => void) | null = null;
  let stopWatch: (() => void) | null = null;

  const init = () => {
    if (import.meta.server) return;
    
    // Initial refresh
    refresh();

    // Watch for user ID to be available before subscribing
    if (stopWatch) stopWatch();
    stopWatch = watch(() => user.value?.id, (newId) => {
      if (newId && !unsubscribe) {
        console.log('[Social] Setting up realtime subscription for user:', newId);
        unsubscribe = subscribeToSocials((eventName) => {
          console.log('[Social] Realtime event received:', eventName);
          // Refresh everything when any social event happens
          refresh();
        });
      }
    }, { immediate: true });
  };

  const cleanup = () => {
    if (stopWatch) {
      stopWatch();
      stopWatch = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  return {
    friendships,
    profiles,
    friends,
    profilesMap,
    pendingCount,
    isLoading,
    refresh,
    init,
    cleanup
  };
};
