<template>
  <div class="space-y-8">
    <div v-motion-slide-visible-once-left>
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">Social</h1>
      <p class="text-lg text-slate-500 dark:text-slate-400 font-normal">Connect with friends and view their progress</p>
    </div>

    <!-- Friend Requests -->
    <div v-if="pendingIncoming.length > 0" v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Friend Requests</h2>
      <div class="space-y-3">
        <div v-for="req in pendingIncoming" :key="req.id" class="flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center overflow-hidden">
              <img v-if="friendsProfiles[req.initiatorid]?.photourl" :src="friendsProfiles[req.initiatorid].photourl" alt="photo" />
              <User v-else class="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div class="font-semibold text-slate-900 dark:text-slate-100">{{ friendsProfiles[req.initiatorid]?.displayname || 'Unknown' }}</div>
              <div class="text-slate-500 text-xs">{{ friendsProfiles[req.initiatorid]?.email }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="acceptRequest(req.id)" class="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm shadow-emerald-500/20">
              <Check class="w-4 h-4" />
            </button>
            <button @click="removeFriend(req.id)" class="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Friend -->
    <div v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Add Friend</h2>
      <form @submit.prevent="handleSearch" class="flex gap-3">
        <div class="relative flex-1">
          <Search class="w-5 h-5 absolute left-3 top-3 text-slate-400" />
          <input
            v-model="searchEmail"
            type="email"
            placeholder="Friend's email address"
            class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
          />
        </div>
        <button type="submit" class="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl transition-colors font-medium cursor-pointer shadow-sm">
          Search
        </button>
      </form>

      <div v-if="searchResults.length > 0" class="mt-4 space-y-3">
        <div v-for="res in searchResults" :key="res.id" class="flex items-center justify-between bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center overflow-hidden">
              <img v-if="res.photourl" :src="res.photourl" alt="photo" />
              <User v-else class="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div class="font-semibold text-slate-900 dark:text-slate-100">{{ res.displayname }}</div>
              <div class="text-slate-500 text-xs">{{ res.email }}</div>
            </div>
          </div>
          
          <span v-if="getExistingFriendship(res.id)" class="text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            {{ getExistingFriendship(res.id)?.status === 'accepted' ? 'Friends' : 'Pending' }}
          </span>
          <button v-else @click="sendRequest(res.id)" class="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors font-medium text-sm cursor-pointer">
            <UserPlus class="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- Friends List -->
    <div v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 px-1">My Friends</h2>
      <p v-if="acceptedFriends.length === 0" class="text-slate-500 dark:text-slate-400 text-sm px-1 italic">No friends added yet. Search by email to connect!</p>
      
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NuxtLink
          v-for="f in acceptedFriends"
          :key="f.id"
          :to="`/friends/${getFriendId(f)}`"
          class="flex items-center gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group shadow-sm hover:shadow-md"
        >
          <div class="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="friendsProfiles[getFriendId(f)]?.photourl" :src="friendsProfiles[getFriendId(f)].photourl" alt="photo" />
            <User v-else class="w-6 h-6 text-slate-400" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {{ friendsProfiles[getFriendId(f)]?.displayname || 'Unknown' }}
            </div>
            <div class="text-slate-500 text-sm truncate">{{ friendsProfiles[getFriendId(f)]?.email }}</div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, UserPlus, Check, X, User } from 'lucide-vue-next';

definePageMeta({ middleware: 'auth' })

const user = useSupabaseUser()
const supabase = useSupabaseClient()

interface UserProfile {
  id: string;
  email: string;
  displayname: string;
  photourl: string;
}

interface Friendship {
  id: string;
  participants: string[];
  initiatorid: string;
  receiverid: string;
  status: "pending" | "accepted";
}

const searchEmail = ref("")
const searchResults = ref<UserProfile[]>([])
const friendships = ref<Friendship[]>([])
const friendsProfiles = ref<Record<string, UserProfile>>({})

const pendingIncoming = computed(() => friendships.value.filter(f => f.status === "pending" && f.receiverid === user.value?.id))
const acceptedFriends = computed(() => friendships.value.filter(f => f.status === "accepted"))

const getFriendId = (f: Friendship) => f.participants.find(p => p !== user.value?.id)!

const getExistingFriendship = (targetId: string) => {
  if (!user.value) return undefined;
  const sorted = [user.value.id, targetId].sort()
  const fid = `${sorted[0]}_${sorted[1]}`
  return friendships.value.find(f => f.id === fid)
}

const loadFriendships = async () => {
  if (!user.value) return;
  
  const { data: loaded, error } = await supabase.from('friendships')
    .select('*')
    .contains('participants', [user.value.id])
    
  if (error) {
    console.error(error);
    return;
  }
  
  friendships.value = loaded as Friendship[];

  const uidsToLoad = new Set<string>();
  loaded.forEach((f: any) => {
    uidsToLoad.add(f.participants[0]);
    uidsToLoad.add(f.participants[1]);
  });
  uidsToLoad.delete(user.value.id);

  if (uidsToLoad.size === 0) {
    friendsProfiles.value = {};
    return;
  }

  const { data: users, error: usersError } = await supabase.from('users')
    .select('*')
    .in('id', Array.from(uidsToLoad));

  if (usersError) {
    console.error(usersError);
    return;
  }

  const profiles: Record<string, UserProfile> = {};
  if (users) {
    users.forEach((u: any) => {
      profiles[u.id] = u as UserProfile;
    });
  }
  
  friendsProfiles.value = profiles;
}

onMounted(loadFriendships)

const handleSearch = async () => {
  if (!searchEmail.value.trim() || !user.value) return;
  
  const { data } = await supabase.from('users').select('*').eq('email', searchEmail.value.trim());
  if (data) {
    searchResults.value = data.filter((u: any) => u.id !== user.value?.id) as UserProfile[];
  }
}

const sendRequest = async (targetUserId: string) => {
  if (!user.value) return;
  const p = [user.value.id, targetUserId].sort();
  const friendshipId = `${p[0]}_${p[1]}`;
  
  await supabase.from('friendships').insert({
    id: friendshipId,
    participants: p,
    initiatorid: user.value.id,
    receiverid: targetUserId,
    status: "pending"
  });
  await loadFriendships();
  searchResults.value = [];
  searchEmail.value = "";
}

const acceptRequest = async (fid: string) => {
  await supabase.from('friendships').update({
    status: "accepted",
    updatedat: new Date().toISOString()
  }).eq("id", fid);
  await loadFriendships();
}

const removeFriend = async (fid: string) => {
  await supabase.from('friendships').delete().eq("id", fid);
  await loadFriendships();
}
</script>
