<template>
  <div class="min-h-[100dvh] text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 h-[57px] bg-nav-bg border-b border-white/10 hidden md:block">
      <div class="h-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <NuxtLink to="/habits" class="flex items-center gap-2 group">
            <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
              <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
            </div>
            <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
              Habits Social
            </span>
          </NuxtLink>

          <template v-if="user">
            <nav class="hidden md:flex items-center gap-1 ml-2">
              <NuxtLink to="/habits" class="nav-link" :class="{ 'nav-link-active': $route.path === '/habits' }">My Habits</NuxtLink>
              <NuxtLink to="/buckets" class="nav-link" :class="{ 'nav-link-active': $route.path === '/buckets' }">Buckets</NuxtLink>
              <NuxtLink to="/social" class="nav-link flex items-center gap-2" :class="{ 'nav-link-active': $route.path === '/social' }">
                Social
                <span v-if="pendingCount > 0" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
              </NuxtLink>
              <NuxtLink to="/inbox" class="nav-link flex items-center gap-2" :class="{ 'nav-link-active': $route.path === '/inbox' }" @click="handleInboxNavClick">
                Inbox
                <span v-if="totalUnreadCount > 0" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
              </NuxtLink>
            </nav>
          </template>
        </div>

        <div v-if="user" class="flex items-center gap-0">
          <button 
            @click="handleEditProfile"
            class="flex items-center gap-2 group text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer px-3 py-2 rounded-xl hover:bg-zinc-900"
          >
            Hi, {{ user.username }}!
          </button>
          <div class="w-px h-6 bg-zinc-800 mx-2 shrink-0"></div>
          <button @click="logout" class="pr-2 py-2 pl-0 text-zinc-500 hover:text-white hover:bg-zinc-925 rounded-lg transition-colors flex items-center justify-center cursor-pointer" title="Logout">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main
      :class="[
        'flex-1 w-full',
        $route.name === 'inbox'
          ? 'max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 pb-0'
          : 'max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 pb-20 md:pb-12'
      ]"
    >
      <slot />
    </main>
    <!-- Mobile Bottom Navigation -->
    <nav v-if="user" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-white/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around">
        <NuxtLink to="/habits" class="flex items-center group transition-colors" :class="($route.path === '/habits' && !showMobileMenu) ? 'text-white' : 'text-zinc-500'">
          <div class="p-2 rounded-xl transition-all duration-300" :class="($route.path === '/habits' && !showMobileMenu) ? 'bg-white/10 scale-110' : 'group-hover:bg-white/5'">
            <ListChecks class="w-6 h-6" />
          </div>
        </NuxtLink>
        <NuxtLink to="/buckets" class="flex items-center group transition-colors" :class="($route.path === '/buckets' && !showMobileMenu) ? 'text-white' : 'text-zinc-500'">
          <div class="p-2 rounded-xl transition-all duration-300" :class="($route.path === '/buckets' && !showMobileMenu) ? 'bg-white/10 scale-110' : 'group-hover:bg-white/5'">
            <PaintBucket class="w-6 h-6" />
          </div>
        </NuxtLink>
        <NuxtLink to="/social" class="flex items-center group transition-colors relative" :class="($route.path === '/social' && !showMobileMenu) ? 'text-white' : 'text-zinc-500'">
          <div class="p-2 rounded-xl transition-all duration-300" :class="($route.path === '/social' && !showMobileMenu) ? 'bg-white/10 scale-110' : 'group-hover:bg-white/5'">
            <Users class="w-6 h-6" />
          </div>
          <!-- Badge -->
          <div v-if="pendingCount > 0" class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-950"></div>
        </NuxtLink>
        <NuxtLink to="/inbox" class="flex items-center group transition-colors relative" :class="($route.path === '/inbox' && !showMobileMenu) ? 'text-white' : 'text-zinc-500'" @click="handleInboxNavClick">
          <div class="p-2 rounded-xl transition-all duration-300" :class="($route.path === '/inbox' && !showMobileMenu) ? 'bg-white/10 scale-110' : 'group-hover:bg-white/5'">
            <MessageCircle class="w-6 h-6" />
          </div>
          <div v-if="totalUnreadCount > 0" class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-950"></div>
        </NuxtLink>
        <button @click="showMobileMenu = !showMobileMenu" class="flex items-center group transition-colors" :class="showMobileMenu ? 'text-white' : 'text-zinc-500'">
          <div class="p-2 rounded-xl transition-all duration-300" :class="showMobileMenu ? 'bg-white/10 scale-110' : 'group-hover:bg-white/5 active:bg-white/10'">
            <Menu class="w-6 h-6" />
          </div>
        </button>
      </div>
    </nav>

    <!-- Mobile Menu Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-full"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-full"
      >
        <div v-if="showMobileMenu" class="fixed inset-x-0 top-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom,0px))] z-[100] flex flex-col justify-end md:hidden">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm touch-none" @click="showMobileMenu = false"></div>
          
          <div class="relative w-full bg-zinc-950 border-t border-zinc-800 rounded-t-3xl shadow-2xl overflow-hidden">
            <div class="p-4 border-b border-zinc-800 flex flex-col items-center gap-4">
              <div class="w-full flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center">
                    <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
                  </div>
                  <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
                    Habits Social
                  </span>
                </div>
                <div class="text-sm font-medium text-zinc-400">
                  Hi, {{ user?.username }}!
                </div>
              </div>
            </div>

            <div class="p-2 flex flex-col gap-1 bg-black">
              <button 
                @click="() => { handleEditProfile(); }"
                class="w-full p-2 flex items-center gap-3 text-zinc-300 hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
              >
                <UserIcon class="w-5 h-5 text-zinc-400" />
                <span class="font-semibold">Edit Profile</span>
              </button>
              
              <button 
                @click="() => { suppressNextHistoryBack(); showMobileMenu = false; logout(); }"
                class="w-full p-2 flex items-center gap-3 text-rose-500 hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut class="w-5 h-5 opacity-80" />
                <span class="font-semibold">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Unified Profile Modal Component -->
    <ProfileModal v-model="showProfileModal" />

    <!-- Choose Avatar Modal on Signup -->
    <ChooseAvatarModal v-model="showChooseAvatarModal" />
  </div>
</template>

<script setup lang="ts">
import { LogOut, Target, ListChecks, Users, User as UserIcon, PaintBucket, MessageCircle, Menu } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const { showToast } = useToast();
const { isOnline } = useNetwork();
const { pendingCount, init: initSocial, cleanup: cleanupSocial, logoutCleanup } = useSocial();
const { totalUnreadCount, init: initChatInbox, logoutCleanup: chatInboxLogoutCleanup } = useChatInbox();
const realtimeInvalidation = useRealtimeInvalidation();

useSeoMeta({
  title: 'My Habits - Habits Social',
  ogTitle: 'Habits Social',
  description: 'Track and build better habits with your friends on Habits Social.',
  ogDescription: 'Track and build better habits with your friends on Habits Social.',
  ogImage: '/icons/icon-512.png',
  twitterCard: 'summary_large_image',
})

onMounted(() => {
  if (user.value) {
    initSocial();
    initChatInbox();
    realtimeInvalidation.start();
  }
  checkJustSignedUp();
});

onUnmounted(() => {
  realtimeInvalidation.stop();
  cleanupSocial();
});

const router = useRouter();
const route = useRoute();

// Profile Modal State
const showProfileModal = useState('showProfileModal', () => false);
const showChooseAvatarModal = ref(false);
const showMobileMenu = ref(false);

const { suppressNextHistoryBack } = useModalHistory(showMobileMenu);

const checkJustSignedUp = () => {
  if (import.meta.client && user.value && sessionStorage.getItem('just-signed-up') === 'true') {
    showChooseAvatarModal.value = true;
    sessionStorage.removeItem('just-signed-up');
  }
};

watch(() => route.path, () => {
  showMobileMenu.value = false;
});

watch(() => user.value?.id, (newId) => {
  if (newId) {
    checkJustSignedUp();
  }
});

const handleInboxNavClick = () => {
  if (route.path === '/inbox' && import.meta.client) {
    window.dispatchEvent(new Event('reset-inbox'));
  }
};

const handleEditProfile = () => {
  if (!isOnline.value) {
    showToast('You are offline. Profile changes require a connection.', 'failed');
    return;
  }
  showProfileModal.value = true;
};

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  logoutCleanup();
  chatInboxLogoutCleanup();

  // Destroy all local data (shared device security).
  // This is the ONLY code path that wipes IndexedDB.
  const { db } = await import('~/utils/db');
  await Promise.all([
    db.habits.clear(),
    db.habitLogs.clear(),
    db.buckets.clear(),
    db.bucketLogs.clear(),
    db.syncQueue.clear(),
    db.syncState.clear(),
  ]);

  // Clear cached auth profile
  if (import.meta.client) localStorage.removeItem('auth-user');

  user.value = null;
  router.push('/login');
};
</script>

<style scoped>
.nav-link {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #71717a;
  transition: color 150ms, background-color 150ms;
}
.nav-link:hover {
  color: white;
  background-color: rgba(39, 39, 42, 0.5);
}
.nav-link-active { color: white; background-color: rgba(63, 63, 70, 0.5); }
</style>
