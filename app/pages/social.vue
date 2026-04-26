<template>
  <div class="space-y-3">
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0">
      <h1 class="text-xl font-bold tracking-tight text-white mb-1">Social</h1>
      <p class="text-zinc-400 text-xs">Connect with friends and view their progress</p>
    </div>

    <!-- Incoming Requests Accordion -->
    <div v-if="pendingIncoming.length > 0" v-motion-fade class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none border-y border-x-0 sm:border border-zinc-800/80 overflow-hidden shadow-2xl">
      <button @click="isRequestsExpanded = !isRequestsExpanded" 
        class="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors cursor-pointer group"
      >
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Friend Requests
          </h2>
          <span class="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/20">
            {{ pendingIncoming.length }}
          </span>
        </div>
        <ChevronDown class="w-4 h-4 text-zinc-600 transition-transform duration-300" :class="{ 'rotate-180': isRequestsExpanded }" />
      </button>

      <div v-show="isRequestsExpanded" class="px-6 pb-6 pt-2">
        <div class="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div v-for="req in pendingIncoming" :key="req.id" class="flex items-center justify-between bg-black border border-zinc-925 p-4 rounded-xl">
            <NuxtLink :to="`/friends/${req.initiatorId}`" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div class="w-10 h-10 bg-zinc-925 rounded-full flex items-center justify-center overflow-hidden">
                <img v-if="profilesMap[req.initiatorId]?.photourl" :src="profilesMap[req.initiatorId]?.photourl" alt="" class="w-full h-full object-cover" />
                <User v-else class="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <div class="font-semibold text-zinc-200 text-sm">{{ profilesMap[req.initiatorId]?.username || 'Unknown' }}</div>
              </div>
            </NuxtLink>
            <div class="flex gap-2">
              <button @click="acceptRequest(req.id)" class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-colors cursor-pointer"><Check class="w-4 h-4" /></button>
              <button @click="declineRequest(req.id)" class="p-2 bg-zinc-925 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors cursor-pointer"><X class="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Combined Social Sections -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none shadow-2xl border-y border-x-0 sm:border border-zinc-800/80 overflow-hidden">
      <!-- Add Friend -->
      <div class="p-6 pb-0">
        <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">Add Friend</h2>
        <form @submit.prevent="handleSearch" class="flex gap-3">
          <div class="relative w-full max-w-md">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input v-model="searchQuery" type="text" placeholder="Search by username..."
              class="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-925 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-600 text-sm transition-all" />
          </div>
        </form>

        <div v-if="searchResults.length > 0" class="mt-4 space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-4">
          <div v-for="res in searchResults" :key="res.id" class="flex items-center justify-between bg-black border border-zinc-925 p-4 rounded-xl">
            <NuxtLink :to="`/friends/${res.id}`" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div class="w-10 h-10 bg-zinc-925 rounded-full flex items-center justify-center overflow-hidden">
                <img v-if="res.photourl" :src="res.photourl" alt="" class="w-full h-full object-cover" />
                <User v-else class="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <div class="font-semibold text-zinc-200 text-sm">{{ res.username }}</div>
              </div>
            </NuxtLink>
            <span v-if="getRelationship(res.id)" class="text-xs font-semibold text-zinc-500 bg-zinc-925 px-3 py-1.5 rounded-full">
              {{ getRelationship(res.id) === 'accepted' ? 'Friends' : 'Pending' }}
            </span>
            <button v-else @click="confirmSendRequest(res)" class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl transition-colors font-semibold text-sm cursor-pointer">
              <UserPlus class="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      <!-- Friends List -->
      <div class="px-6 pt-6 pb-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 sm:pr-1">
          <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500">My Friends</h2>
          <div class="relative w-full sm:max-w-[240px]">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              v-model="friendsSearchQuery"
              type="text" 
              placeholder="Filter friends..." 
              class="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-925 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-600 text-sm transition-all"
            />
          </div>
        </div>
        
        <p v-if="displayFriends.length === 0" class="text-zinc-600 text-sm italic">No friends yet. Search for people above!</p>
        <p v-else-if="filteredDisplayFriends.length === 0" class="text-zinc-600 text-sm italic">No friends found matching your filter.</p>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div 
            v-for="f in filteredDisplayFriends" :key="f.id"
            @click="handleFriendClick(f)"
            class="flex items-center gap-4 p-4 rounded-xl border border-zinc-925 bg-black transition-all group shadow-sm hover:border-zinc-700 hover:shadow-md cursor-pointer"
          >
            <div class="w-12 h-12 bg-zinc-925 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              <img v-if="profilesMap[getFriendId(f)]?.photourl" :src="profilesMap[getFriendId(f)]?.photourl" alt="" class="w-full h-full object-cover" />
              <User v-else class="w-6 h-6 text-zinc-600" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <div class="font-semibold text-zinc-200 truncate transition-colors text-sm" :class="{ 'group-hover:text-white': f.status === 'accepted' }">
                  {{ profilesMap[getFriendId(f)]?.username || 'Unknown' }}
                </div>
                <span v-if="f.status === 'pending'" class="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-zinc-925 px-2 py-0.5 rounded-md shrink-0">
                  Pending
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button 
                @click.stop="confirmUnfriend(f)" 
                class="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                :title="f.status === 'pending' ? 'Cancel Request' : 'Unfriend'"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unfriend Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showUnfriendModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showUnfriendModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <User class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">{{ friendshipToUnfriend?.status === 'pending' ? 'Cancel Request?' : 'Unfriend?' }}</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              {{ friendshipToUnfriend?.status === 'pending' 
                ? `Cancel your friend request to ${unfriendDisplayName}?`
                : `Are you sure you want to unfriend ${unfriendDisplayName}?` 
              }}
            </p>
            <div class="flex flex-col gap-3">
              <button @click="executeUnfriend" class="w-full px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer">
                {{ friendshipToUnfriend?.status === 'pending' ? 'Cancel Request' : 'Unfriend' }}
              </button>
              <button @click="showUnfriendModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add Friend Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showAddModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showAddModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus class="w-8 h-8 text-white" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Send Request?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Send a friend request to <span class="text-zinc-200 font-medium">{{ userToRequest?.username }}</span>?
            </p>
            <div class="flex flex-col gap-3">
              <button @click="executeSendRequest" class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer">
                Send Request
              </button>
              <button @click="showAddModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Share Habits Modal (Post-Request) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showShareModal" 
          class="fixed inset-0 z-[110] flex items-center justify-center sm:p-4 p-0"
          :class="{ 'modal-parent-adaptive': isHeightOverflowing }"
        >
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showShareModal = false"></div>
          <div 
            ref="modalContent"
            class="relative w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
            :class="{ 'modal-adaptive-height': isHeightOverflowing }"
          >
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check class="w-8 h-8 text-white" />
              </div>
              <h2 class="text-xl font-bold text-white mb-2">{{ shareModalTitle }}</h2>
              <p class="text-zinc-500 text-sm">
                Which habits would you like to share with <span class="text-zinc-200 font-medium">{{ userBeingSharedWith?.username }}</span>?
              </p>
            </div>
            
            <!-- Selection Controls -->
            <div class="flex items-center justify-between mb-3 px-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">My habits</label>
              <button 
                @click="toggleSelectAllHabits"
                title="Select/Unselect All"
                class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <CheckSquare class="w-4 h-4" />
              </button>
            </div>

            <div class="max-h-[320px] overflow-y-auto pr-2 space-y-2 mb-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <div v-for="habit in myHabits" :key="habit.id" 
                @click="toggleHabitSelection(habit.id)"
                class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group"
                :class="selectedHabitIds.includes(habit.id) ? 'bg-white/5 border-white/20' : 'bg-black border-zinc-900 hover:border-zinc-700'"
              >
                <div class="flex-1 text-sm text-zinc-200 font-medium">{{ habit.title }}</div>
                <div class="w-5 h-5 rounded-md border flex items-center justify-center transition-all"
                  :class="selectedHabitIds.includes(habit.id) ? 'bg-white border-white text-black' : 'border-zinc-700 group-hover:border-zinc-500'"
                >
                  <Check v-if="selectedHabitIds.includes(habit.id)" class="w-3 h-3" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <button @click="executeBatchShare" class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer">
                {{ selectedHabitIds.length > 0 ? `Share ${selectedHabitIds.length} habits` : 'Continue' }}
              </button>
              <button @click="showShareModal = false" class="w-full px-5 py-3 bg-transparent hover:bg-zinc-925 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Search, UserPlus, UserMinus, Check, X, User, Trash2, ChevronDown, CheckSquare } from 'lucide-vue-next';
import { useSocial } from '../composables/useSocial';

definePageMeta({ middleware: 'auth' });

const { user } = useAuth();

interface UserProfile { id: string; email: string; username: string; photourl?: string; }
interface Friendship { id: string; participants: string[]; initiatorId: string; receiverId: string; status: 'pending' | 'accepted'; }

const searchQuery = ref('');
const friendsSearchQuery = ref('');
const isRequestsExpanded = ref(false);
const searchResults = ref<UserProfile[]>([]);
const { 
  friendships, 
  profilesMap, 
  refresh: refreshSocial, 
  init: initSocial, 
  cleanup: cleanupSocial 
} = useSocial();
const showUnfriendModal = ref(false);
const friendshipToUnfriend = ref<Friendship | null>(null);
const unfriendDisplayName = ref('');
const showAddModal = ref(false);
const userToRequest = ref<UserProfile | null>(null);
const showShareModal = ref(false);
const myHabits = ref<any[]>([]);
const selectedHabitIds = ref<string[]>([]);
const userBeingSharedWith = ref<UserProfile | null>(null);
const shareModalTitle = ref('Request Sent!');

const isAnyModalOpen = ref(false);
watch([showUnfriendModal, showAddModal, showShareModal], (vals) => {
  isAnyModalOpen.value = vals.some(v => v);
});
useModalHistory(isAnyModalOpen, () => {
  showUnfriendModal.value = false;
  showAddModal.value = false;
  showShareModal.value = false;
});

const pendingIncoming = computed(() => {
  if (!user.value?.id) return [];
  const myId = String(user.value.id);
  return friendships.value.filter((f: any) => f.status === 'pending' && String(f.receiverId) === myId);
});

const pendingOutgoing = computed(() => {
  if (!user.value?.id) return [];
  const myId = String(user.value.id);
  return friendships.value.filter((f: any) => f.status === 'pending' && String(f.initiatorId) === myId);
});

const acceptedFriends = computed(() => {
  return friendships.value.filter((f: any) => f.status === 'accepted');
});

const displayFriends = computed(() => {
  const combined = [...acceptedFriends.value, ...pendingOutgoing.value];
  if (!user.value?.id) return combined;
  const myId = String(user.value.id);
  
  return combined
    .filter((f: any) => {
      const friendId = getFriendId(f);
      return friendId && friendId !== myId;
    })
    .sort((a, b) => {
      const nameA = profilesMap.value[getFriendId(a)]?.username || '';
      const nameB = profilesMap.value[getFriendId(b)]?.username || '';
      return nameA.localeCompare(nameB);
    });
});

const filteredDisplayFriends = computed(() => {
  if (!friendsSearchQuery.value.trim()) return displayFriends.value;
  const q = friendsSearchQuery.value.toLowerCase().trim();
  return displayFriends.value.filter((f: any) => {
    const username = profilesMap.value[getFriendId(f)]?.username.toLowerCase() || '';
    return username.includes(q);
  });
});
const getFriendId = (f: Friendship) => {
  if (!user.value?.id) return '';
  const myId = String(user.value.id);
  return f.participants?.find(p => String(p) !== myId) ?? '';
};
const getRelationship = (targetId: string) => friendships.value.find((f: any) => f.participants?.includes(targetId))?.status;

const handleFriendClick = (f: Friendship) => {
  navigateTo(`/friends/${getFriendId(f)}`);
};

// Modal Adaptive Logic
const modalContent = ref<HTMLElement | null>(null);
const isHeightOverflowing = ref(false);

const checkHeightOverflow = () => {
  if (!modalContent.value) return;
  isHeightOverflowing.value = modalContent.value.scrollHeight > (window.innerHeight - 32);
};

watch([showShareModal, myHabits], async () => {
  if (showShareModal.value) {
    await nextTick();
    checkHeightOverflow();
    setTimeout(checkHeightOverflow, 350);
  } else {
    isHeightOverflowing.value = false;
  }
});

// Scroll Lock
watch([showUnfriendModal, showAddModal, showShareModal], (newVal) => {
  if (typeof document === 'undefined') return;
  const isAnyOpen = newVal.some(v => v);
  if (isAnyOpen) document.body.classList.add('overflow-hidden');
  else document.body.classList.remove('overflow-hidden');
});

const loadFriendships = async () => {
  await refreshSocial();
};

const { pendingCount } = useSocialNotifications();

onMounted(() => {
  loadFriendships();
  // Social state is now initialized globally in default.vue layout
  window.addEventListener('resize', checkHeightOverflow);
});

onUnmounted(() => {
  // cleanupSocial(); // Now a no-op singleton cleanup handled by logout
  window.removeEventListener('resize', checkHeightOverflow);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('overflow-hidden');
  }
});

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchResults.value = await $fetch<UserProfile[]>('/api/social/search', { query: { username: searchQuery.value.trim() } });
};

let searchTimeout: any;
watch(searchQuery, (val) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(handleSearch, 300);
});

const confirmSendRequest = (u: UserProfile) => {
  userToRequest.value = u;
  showAddModal.value = true;
};

const executeSendRequest = async () => {
  if (!userToRequest.value) return;
  const target = userToRequest.value;
  await $fetch('/api/social/friends', { method: 'POST', body: { targetUserId: target.id } });
  await loadFriendships();
  
  // Setup for share modal
  userBeingSharedWith.value = target;
  const habitsData = await $fetch<any[]>('/api/habits');
  myHabits.value = habitsData;
  selectedHabitIds.value = [];
  
  showAddModal.value = false;
  userToRequest.value = null;
  searchResults.value = [];
  searchQuery.value = '';
  
  // Open share modal if user has habits
  if (habitsData.length > 0) {
    shareModalTitle.value = 'Request Sent!';
    showShareModal.value = true;
  }
};

const toggleHabitSelection = (id: string) => {
  const index = selectedHabitIds.value.indexOf(id);
  if (index === -1) selectedHabitIds.value.push(id);
  else selectedHabitIds.value.splice(index, 1);
};

const toggleSelectAllHabits = () => {
  if (selectedHabitIds.value.length === myHabits.value.length) {
    selectedHabitIds.value = [];
  } else {
    selectedHabitIds.value = myHabits.value.map((h: any) => h.id);
  }
};

const executeBatchShare = async () => {
  if (!userBeingSharedWith.value) return;
  if (selectedHabitIds.value.length > 0) {
    await $fetch('/api/social/share-habits', { 
      method: 'POST', 
      body: { 
        targetUserId: userBeingSharedWith.value.id, 
        habitIds: selectedHabitIds.value 
      } 
    });
  }
  showShareModal.value = false;
};

const acceptRequest = async (fid: string) => {
  const friendship = friendships.value.find((f: any) => f.id === fid);
  if (!friendship) return;
  
  const initiatorId = friendship.initiatorId;
  const initiatorProfile = profilesMap.value[initiatorId];

  await $fetch(`/api/social/requests/${fid}`, { method: 'PUT' });
  await loadFriendships();

  // Setup for share modal
  if (initiatorProfile) {
    userBeingSharedWith.value = initiatorProfile;
    const habitsData = await $fetch<any[]>('/api/habits');
    myHabits.value = habitsData;
    selectedHabitIds.value = [];
    
    if (habitsData.length > 0) {
      shareModalTitle.value = 'Request Accepted!';
      showShareModal.value = true;
    }
  }
};

const declineRequest = async (fid: string) => {
  await $fetch(`/api/social/requests/${fid}`, { method: 'DELETE' });
  await loadFriendships();
};

const confirmUnfriend = (f: Friendship) => {
  friendshipToUnfriend.value = f;
  unfriendDisplayName.value = profilesMap.value[getFriendId(f)]?.username || 'Unknown';
  showUnfriendModal.value = true;
};

const executeUnfriend = async () => {
  if (!friendshipToUnfriend.value) return;
  const fid = friendshipToUnfriend.value.id;
  
  // Close modal first to avoid flickering when data reloads
  showUnfriendModal.value = false;
  
  await $fetch(`/api/social/requests/${fid}`, { method: 'DELETE' });
  await loadFriendships();
  
  // Clear reference after data is reloaded
  friendshipToUnfriend.value = null;
  unfriendDisplayName.value = '';
};
</script>
