<template>
  <div class="min-h-[100dvh] text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 h-[57px] bg-black border-b border-white/10">
      <div class="h-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <NuxtLink to="/" class="flex items-center gap-2 group">
            <div class="w-8 h-8 rounded-full bg-transparent flex items-center justify-center shadow-md shadow-white/10 group-hover:shadow-white/20 transition-shadow overflow-hidden">
              <img src="/icons/icon-192.png" class="w-full h-full object-cover scale-[1.35] transform-gpu" alt="Logo" />
            </div>
            <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
              Habits Social
            </span>
          </NuxtLink>

          <template v-if="user">
            <nav class="hidden md:flex items-center gap-1 ml-2">
              <NuxtLink to="/" class="nav-link" :class="{ 'nav-link-active': $route.path === '/' }">My Habits</NuxtLink>
              <NuxtLink to="/buckets" class="nav-link" :class="{ 'nav-link-active': $route.path === '/buckets' }">Buckets</NuxtLink>
              <NuxtLink to="/social" class="nav-link flex items-center gap-2" :class="{ 'nav-link-active': $route.path === '/social' }">
                Social
                <span v-if="pendingCount > 0 && $route.path !== '/social'" class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
              </NuxtLink>
            </nav>
          </template>
        </div>

        <div v-if="user" class="flex items-center gap-0">
          <button 
            @click="showProfileModal = true"
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

    <main class="flex-1 w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 pb-20 md:pb-12">
      <slot />
    </main>
    <!-- Mobile Bottom Navigation -->
    <nav v-if="user" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around gap-8">
        <NuxtLink to="/" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <LayoutDashboard class="w-6 h-6" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest">My Habits</span>
        </NuxtLink>
        <NuxtLink to="/buckets" class="flex flex-col items-center gap-1 group transition-colors" :class="$route.path === '/buckets' ? 'text-white' : 'text-zinc-500'">
          <div class="p-1 rounded-lg transition-colors" :class="$route.path === '/buckets' ? 'bg-white/10' : 'group-hover:bg-white/5'">
            <PaintBucket class="w-6 h-6" />
          </div>
          <span class="text-[10px] font-bold uppercase tracking-widest">Buckets</span>
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
  </div>
</template>

<script setup lang="ts">
import { LogOut, LayoutDashboard, Users, User as UserIcon, PaintBucket } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const { pendingCount, init: initSocial, cleanup: cleanupSocial, logoutCleanup } = useSocial();

useSeoMeta({
  title: 'My Habits - HabitsSocial',
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
