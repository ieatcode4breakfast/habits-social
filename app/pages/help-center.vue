<template>
  <div class="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
    <!-- Top Header (Desktop & Mobile) -->
    <header class="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button @click="isSidebarOpen = true" class="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors md:hidden">
          <MenuIcon class="w-6 h-6" />
        </button>
        <NuxtLink to="/help-center" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
            <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-zinc-200 dark:to-zinc-400 hidden sm:inline">
            Habits Social
          </span>
          <span class="text-zinc-400 mx-1 hidden sm:inline">|</span>
          <span class="font-bold text-lg">Help Center</span>
        </NuxtLink>
      </div>
      <button @click="toggleThemeMode" class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" :title="themeToggleTitle">
        <SunIcon v-if="isLightMode" class="w-5 h-5" />
        <MoonIcon v-else class="w-5 h-5" />
      </button>
    </header>

    <div class="flex flex-1 flex-col md:flex-row min-h-0">
      <!-- Mobile Sidebar Backdrop -->
      <div 
        v-if="isSidebarOpen" 
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <!-- Sidebar -->
      <aside 
        :class="[
          'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-64 lg:w-72',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ]"
      >
        <div class="h-full flex flex-col">
          <div class="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 md:hidden">
            <span class="font-bold text-lg">Menu</span>
            <button @click="isSidebarOpen = false" class="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <XIcon class="w-6 h-6" />
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto p-4 space-y-1">
            <div v-if="pending" class="px-3 py-2 text-sm text-zinc-500">Loading...</div>
            <div v-else-if="error" class="px-3 py-2 text-sm text-rose-500">Error loading navigation</div>
            
            <template v-else>
              <NuxtLink 
                v-for="link in navigation" 
                :key="link.path" 
                :to="link.path"
                class="block px-3 py-2 text-sm rounded-lg transition-colors"
                active-class="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-medium"
                :class="[
                  $route.path === link.path ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                ]"
                @click="isSidebarOpen = false"
              >
                {{ link.title || link.path.split('/').pop() }}
              </NuxtLink>
            </template>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950/50">
        <div class="max-w-4xl mx-auto px-4 py-8 md:px-8 lg:px-12">
          <NuxtPage />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon, Sun as SunIcon, Moon as MoonIcon } from 'lucide-vue-next';
import { useThemeMode } from '~/composables/useThemeMode';

definePageMeta({
  layout: false
});

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();
const isSidebarOpen = ref(false);

const { data: navigation, pending, error } = await useAsyncData('help-navigation', async () => {
  const docs = await queryCollection('docs').select('title', 'path', 'id').all();
  // Sort by id to maintain the 001, 002 order from filenames, then return
  return docs.sort((a, b) => a.id.localeCompare(b.id));
});

// Close sidebar when navigating on mobile
const route = useRoute();
watch(() => route.path, () => {
  isSidebarOpen.value = false;
});

// Meta tags for help section
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - Help Center` : 'Help Center - Habits Social';
  }
});
</script>
