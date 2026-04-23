<template>
  <div class="space-y-3">
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0">
      <h1 class="text-3xl font-bold tracking-tight text-white mb-1">Social</h1>
      <p class="text-zinc-400">Connect with friends and view their progress</p>
    </div>

    <!-- Incoming Requests -->
    <div v-if="pendingIncoming.length > 0" v-motion-fade class="bg-zinc-900/80 backdrop-blur-sm sm:rounded-2xl rounded-none p-6 shadow-2xl border border-zinc-800/80">
      <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Friend Requests</h2>
      <div class="space-y-3">
        <div v-for="req in pendingIncoming" :key="req.id" class="flex items-center justify-between bg-black border border-zinc-900 p-4 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden">
              <img v-if="profilesMap[req.initiatorid]?.photourl" :src="profilesMap[req.initiatorid]?.photourl" alt="" class="w-full h-full object-cover" />
              <User v-else class="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <div class="font-semibold text-zinc-200 text-sm">{{ profilesMap[req.initiatorid]?.displayname || 'Unknown' }}</div>
              <div class="text-zinc-500 text-xs">{{ profilesMap[req.initiatorid]?.email }}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="acceptRequest(req.id)" class="p-2 bg-white hover:bg-zinc-200 text-black rounded-lg transition-colors cursor-pointer"><Check class="w-4 h-4" /></button>
            <button @click="declineRequest(req.id)" class="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors cursor-pointer"><X class="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Friend -->
    <div v-motion-fade class="bg-zinc-900/80 backdrop-blur-sm sm:rounded-2xl rounded-none p-6 shadow-2xl border border-zinc-800/80">
      <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">Add Friend</h2>
      <form @submit.prevent="handleSearch" class="flex gap-3">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input v-model="searchEmail" type="email" placeholder="Friend's email address"
            class="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-600 text-sm transition-all" />
        </div>
        <button type="submit" class="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl transition-colors font-semibold text-sm cursor-pointer shadow-sm">Search</button>
      </form>

      <div v-if="searchResults.length > 0" class="mt-4 space-y-3">
        <div v-for="res in searchResults" :key="res.id" class="flex items-center justify-between bg-black border border-zinc-900 p-4 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden">
              <img v-if="res.photourl" :src="res.photourl" alt="" class="w-full h-full object-cover" />
              <User v-else class="w-5 h-5 text-zinc-600" />
            </div>
            <div>
              <div class="font-semibold text-zinc-200 text-sm">{{ res.displayname }}</div>
              <div class="text-zinc-500 text-xs">{{ res.email }}</div>
            </div>
          </div>
          <span v-if="getRelationship(res.id)" class="text-xs font-semibold text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full">
            {{ getRelationship(res.id) === 'accepted' ? 'Friends' : 'Pending' }}
          </span>
          <button v-else @click="sendRequest(res.id)" class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl transition-colors font-semibold text-sm cursor-pointer">
            <UserPlus class="w-4 h-4" /> Add
          </button>
        </div>
      </div>
    </div>

    <!-- Friends List -->
    <div v-motion-fade class="bg-zinc-900/80 backdrop-blur-sm sm:rounded-2xl rounded-none p-6 shadow-2xl border border-zinc-800/80">
      <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">My Friends</h2>
      <p v-if="acceptedFriends.length === 0" class="text-zinc-600 text-sm italic">No friends yet. Search by email above!</p>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NuxtLink v-for="f in acceptedFriends" :key="f.id" :to="`/friends/${getFriendId(f)}`"
          class="flex items-center gap-4 p-4 rounded-xl border border-zinc-900 hover:border-zinc-700 bg-black transition-all group shadow-sm hover:shadow-md">
          <div class="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="profilesMap[getFriendId(f)]?.photourl" :src="profilesMap[getFriendId(f)]?.photourl" alt="" class="w-full h-full object-cover" />
            <User v-else class="w-6 h-6 text-zinc-600" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-zinc-200 truncate group-hover:text-white transition-colors text-sm">
              {{ profilesMap[getFriendId(f)]?.displayname || 'Unknown' }}
            </div>
            <div class="text-zinc-500 text-xs truncate">{{ profilesMap[getFriendId(f)]?.email }}</div>
          </div>
          <ChevronRight class="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors flex-shrink-0" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, UserPlus, Check, X, User, ChevronRight } from 'lucide-vue-next';

definePageMeta({ middleware: 'auth' });

const { user } = useAuth();

interface UserProfile { id: string; email: string; displayname: string; photourl?: string; }
interface Friendship { id: string; participants: string[]; initiatorid: string; receiverid: string; status: 'pending' | 'accepted'; }

const searchEmail = ref('');
const searchResults = ref<UserProfile[]>([]);
const friendships = ref<Friendship[]>([]);
const profilesMap = ref<Record<string, UserProfile>>({});

const pendingIncoming = computed(() => friendships.value.filter(f => f.status === 'pending' && f.receiverid === user.value?.id));
const acceptedFriends = computed(() => friendships.value.filter(f => f.status === 'accepted'));
const getFriendId = (f: Friendship) => f.participants.find(p => p !== user.value?.id) ?? '';
const getRelationship = (targetId: string) => friendships.value.find(f => f.participants.includes(targetId))?.status;

const loadFriendships = async () => {
  const data = await $fetch<{ friendships: Friendship[]; profiles: UserProfile[] }>('/api/social/friends');
  friendships.value = data.friendships;
  const map: Record<string, UserProfile> = {};
  data.profiles.forEach(p => { map[p.id] = p; });
  profilesMap.value = map;
};

onMounted(loadFriendships);

const handleSearch = async () => {
  if (!searchEmail.value.trim()) return;
  searchResults.value = await $fetch<UserProfile[]>('/api/social/search', { query: { email: searchEmail.value.trim() } });
};

const sendRequest = async (targetUserId: string) => {
  await $fetch('/api/social/friends', { method: 'POST', body: { targetUserId } });
  await loadFriendships();
  searchResults.value = [];
  searchEmail.value = '';
};

const acceptRequest = async (fid: string) => {
  await $fetch(`/api/social/requests/${fid}`, { method: 'PUT' });
  await loadFriendships();
};

const declineRequest = async (fid: string) => {
  await $fetch(`/api/social/requests/${fid}`, { method: 'DELETE' });
  await loadFriendships();
};
</script>
