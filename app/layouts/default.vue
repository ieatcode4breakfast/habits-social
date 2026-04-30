<template>
  <div class="min-h-[100dvh] text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/5">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-full bg-transparent flex items-center justify-center shadow-md shadow-white/10 group-hover:shadow-white/20 transition-shadow overflow-hidden">
            <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
            Habits Social
          </span>
        </NuxtLink>

        <div v-if="user" class="flex items-center gap-0">
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="nav-link" :class="{ 'nav-link-active': $route.path === '/' }">Dashboard</NuxtLink>
            <NuxtLink to="/social" class="nav-link flex items-center gap-2" :class="{ 'nav-link-active': $route.path === '/social' }">
              Social
              <span v-if="pendingCount > 0 && $route.path !== '/social'" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
            </NuxtLink>
          </nav>
          <div class="w-px h-6 bg-zinc-800 hidden md:block mx-2 shrink-0"></div>
          <button 
            @click="showProfileModal = true"
            class="flex items-center gap-2 group text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-1 rounded-lg hover:bg-zinc-900"
          >
            <UserAvatar 
              :src="user.photourl" 
              container-class="w-6 h-6 bg-zinc-800 border border-zinc-700"
              icon-class="w-3.5 h-3.5 text-zinc-500"
            />
            Hi, {{ user.username }}!
          </button>
          <div class="w-px h-6 bg-zinc-800 mx-2 shrink-0"></div>
          <button @click="logout" class="pr-2 py-2 pl-0 text-zinc-500 hover:text-white hover:bg-zinc-925 rounded-lg transition-colors flex items-center justify-center cursor-pointer" title="Logout">
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 py-8 pb-20 md:py-12">
      <slot />
    </main>
    <!-- Mobile Bottom Navigation -->
    <nav v-if="user" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around gap-8">
        <NuxtLink to="/" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <LayoutDashboard class="w-6 h-6" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Dashboard</span>
        </NuxtLink>
        <NuxtLink to="/social" class="flex flex-col items-center gap-1 group transition-colors relative" :class="$route.path === '/social' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/social' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <Users class="w-6 h-6" />
          </div>
          <!-- Badge -->
          <div v-if="pendingCount > 0 && $route.path !== '/social'" class="absolute top-0 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-black"></div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Social</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Unified Profile Modal Component -->
    <ProfileModal v-model="showProfileModal" />
    
    <!-- Global Toast Notification -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isVisible" class="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-2.5 bg-zinc-900/90 border border-white/10 rounded-full backdrop-blur-xl shadow-2xl ring-1 ring-white/5 pointer-events-none">
          <div class="flex items-center justify-center w-6 h-6 rounded-lg" :class="{
            'bg-emerald-500/20 text-emerald-500': type === 'completed',
            'bg-rose-500/20 text-rose-500': type === 'failed',
            'bg-zinc-500/20 text-zinc-400': type === 'skipped',
            'bg-zinc-800/50 text-zinc-600': type === 'cleared'
          }">
            <CheckIcon v-if="type === 'completed'" class="w-4 h-4" />
            <XIcon v-else-if="type === 'failed'" class="w-4 h-4" />
            <MinusIcon v-else-if="type === 'skipped'" class="w-4 h-4" />
          </div>
          <span class="text-sm font-bold tracking-tight text-white pr-2">{{ message }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { LogOut, LayoutDashboard, Users, User as UserIcon, Check as CheckIcon, X as XIcon, Minus as MinusIcon } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const { pendingCount, init: initSocial, cleanup: cleanupSocial, logoutCleanup } = useSocial();
const { isVisible, message, type } = useToast();

useSeoMeta({
  title: 'Dashboard - HabitsSocial',
  ogTitle: 'HabitsSocial',
  description: 'Track and build better habits with your friends on HabitsSocial.',
  ogDescription: 'Track and build better habits with your friends on HabitsSocial.',
  ogImage: '/icons/icon-512.png',
  twitterCard: 'summary_large_image',
})

onMounted(() => {
  if (user.value) {
    initSocial();
  }
});

onUnmounted(() => {
  cleanupSocial();
});

const router = useRouter();
const route = useRoute();

// Profile Modal State
const showProfileModal = ref(false);

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  logoutCleanup();
  await fetchUser();
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
