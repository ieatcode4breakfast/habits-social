import { ref, computed, watch } from 'vue';
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
  initiatorFavorite?: boolean;
  receiverFavorite?: boolean;
}

// Module-level state to ensure singleton behavior for the subscription
let globalUnsubscribe: (() => void) | null = null;
let globalStopWatch: (() => void) | null = null;
let isInitialized = false;

export const useSocial = () => {
  const { user } = useAuth();
  const { subscribeToSocials } = useRealtime();

  // Global state using Nuxt's useState (shared across all instances)
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
      // Use cache-busting timestamp to ensure fresh data
      const data = await $fetch<{ friendships: Friendship[]; profiles: UserProfile[] }>(`/api/social/friends?t=${Date.now()}`);
      friendships.value = data.friendships;
      profiles.value = data.profiles;
      
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

  const init = () => {
    if (import.meta.server || isInitialized) return;
    
    console.log('[Social] Initializing global social state...');
    isInitialized = true;
    
    // Initial fetch
    refresh();

    // Setup singleton watcher and subscription
    if (globalStopWatch) globalStopWatch();
    globalStopWatch = watch(() => user.value?.id, (newId) => {
      if (newId && !globalUnsubscribe) {
        console.log('[Social] Subscribing to global realtime events for user:', newId);
        globalUnsubscribe = subscribeToSocials((eventName, data) => {
          console.log(`[Social] Realtime event [${eventName}] received:`, data);
          
          // Optimistic update for friendships
          if (eventName === 'friend-request-accepted' || eventName === 'friend-request-received') {
            const index = friendships.value.findIndex(f => f.id === data.id);
            if (index !== -1) {
              friendships.value[index] = { ...friendships.value[index], ...data };
            } else {
              friendships.value.push(data);
            }
          } else if (eventName === 'friendship-removed') {
            friendships.value = friendships.value.filter(f => f.id !== data.id);
          }

          // Always refresh from source to ensure full profile data and consistency
          refresh();
        });
      }
    }, { immediate: true });
  };

  // We expose a cleanup but typically we want to keep it alive 
  // unless we explicitly want to kill the social features.
  const cleanup = () => {
    // In a singleton pattern, we might choose NOT to cleanup on unmount
    // so that the listener stays alive while navigating between pages.
    // We only cleanup if explicitly requested or on logout.
  };

  const logoutCleanup = () => {
    if (globalStopWatch) {
      globalStopWatch();
      globalStopWatch = null;
    }
    if (globalUnsubscribe) {
      globalUnsubscribe();
      globalUnsubscribe = null;
    }
    isInitialized = false;
    friendships.value = [];
    profiles.value = [];
    pendingCount.value = 0;
  };

  const toggleFavorite = async (friendshipId: string, favorite: boolean) => {
    try {
      const updated = await $fetch<Friendship>('/api/social/friends/favorite', {
        method: 'PUT',
        body: { friendshipId, favorite }
      });
      
      const idx = friendships.value.findIndex(f => f.id === friendshipId);
      if (idx !== -1) {
        friendships.value[idx] = { ...friendships.value[idx], ...updated };
      }
    } catch (e) {
      console.error('[Social] Failed to toggle favorite', e);
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
    cleanup,
    logoutCleanup,
    toggleFavorite
  };
};
