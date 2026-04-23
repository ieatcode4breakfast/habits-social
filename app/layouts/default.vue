<template>
  <div class="min-h-screen text-zinc-100 flex flex-col transition-colors duration-300">
    <header class="sticky top-0 z-50 px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/5">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-md shadow-white/10 group-hover:shadow-white/20 transition-shadow">
            <Activity class="w-5 h-5 text-black" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400">
            Habits Social
          </span>
        </NuxtLink>

        <div v-if="user" class="flex items-center gap-2">
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="nav-link" :class="{ 'nav-link-active': $route.path === '/' }">Dashboard</NuxtLink>
            <NuxtLink to="/social" class="nav-link" :class="{ 'nav-link-active': $route.path === '/social' }">Social</NuxtLink>
          </nav>
          <div class="w-px h-6 bg-zinc-800 hidden md:block mx-1"></div>
          <button @click="logout" class="px-3 py-2 text-sm font-medium text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
            <LogOut class="w-4 h-4" />
            <span class="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 py-8 md:py-12">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { Activity, LogOut } from 'lucide-vue-next';

const { user, fetchUser } = useAuth();
const router = useRouter();
const route = useRoute();

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
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
