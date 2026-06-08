<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col transition-colors duration-200">
    <!-- Top Header (Desktop & Mobile) -->
    <header class="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button @click="isSidebarOpen = true" class="p-2 -ml-2 rounded-lg hover:bg-zinc-900 transition-colors md:hidden">
          <MenuIcon class="w-6 h-6" />
        </button>
        <NuxtLink to="/help-center" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
            <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400 hidden sm:inline">
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
          'fixed inset-y-0 left-0 z-50 md:z-20 w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-[65px] md:h-[calc(100vh-65px)] md:self-start md:w-80 lg:w-[350px]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ]"
      >
        <div class="h-full flex flex-col">
          <div class="p-4 flex items-center justify-between border-b border-zinc-800 md:hidden">
            <span class="font-bold text-lg">Help Center</span>
            <button @click="isSidebarOpen = false" class="p-2 -mr-2 rounded-lg hover:bg-zinc-900 transition-colors">
              <XIcon class="w-6 h-6" />
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto p-4 space-y-1">
            <div v-if="pending" class="px-3 py-2 text-sm text-zinc-500">Loading...</div>
            <div v-else-if="error" class="px-3 py-2 text-sm text-rose-500">Error loading navigation</div>
            
            <template v-else>
              <div v-for="link in navigation" :key="link.path" class="mb-1">
                <NuxtLink 
                  :to="link.path"
                  class="flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group"
                  active-class="bg-emerald-500/10 text-emerald-400 font-medium"
                  :class="[
                    'block px-4 py-2.5 text-sm transition-colors rounded-lg',
                    $route.path === link.path ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                  ]"
                  @click="isSidebarOpen = false"
                >
                  <span class="truncate pr-2">{{ link.title || link.path.split('/').pop() }}</span>
                  <button 
                    v-if="link.body?.toc?.links?.length"
                    @click.prevent.stop="toggleAccordion(link.path)"
                    class="p-1 -mr-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    <ChevronDown v-if="expandedNavs[link.path]" class="w-4 h-4" />
                    <ChevronRight v-else class="w-4 h-4" />
                  </button>
                </NuxtLink>

                <!-- Subheaders Accordion -->
                <div v-if="expandedNavs[link.path] && link.body?.toc?.links?.length" class="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-2">
                  <NuxtLink
                    v-for="sublink in link.body.toc.links"
                    :key="sublink.id"
                    :to="`${link.path}#${sublink.id}`"
                    class="block px-2 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-800/50 truncate"
                    @click="isSidebarOpen = false"
                  >
                    {{ sublink.text }}
                  </NuxtLink>
                </div>
              </div>
            </template>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-w-0 bg-black">
        <div class="max-w-4xl mx-auto px-4 py-8 md:px-8 lg:px-12">
          <NuxtPage :page-key="route => route.fullPath" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon, Sun as SunIcon, Moon as MoonIcon, ChevronDown, ChevronRight } from 'lucide-vue-next';
import { useThemeMode } from '~/composables/useThemeMode';

definePageMeta({
  layout: false,
  middleware: [
    (to) => {
      if (to.path === '/help-center') {
        return navigateTo('/help-center/welcome', { replace: true })
      }
    }
  ]
});

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();
const isSidebarOpen = ref(false);

const { data: navigation, pending, error } = await useAsyncData('help-navigation', async () => {
  const docs = await queryCollection('docs').select('title', 'path', 'order', 'body').all();
  // Sort by order frontmatter (ensure strict number casting for TypeScript)
  return docs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
});

const expandedNavs = ref<Record<string, boolean>>({});

function toggleAccordion(path: string) {
  expandedNavs.value[path] = !expandedNavs.value[path];
}

// Close sidebar when navigating on mobile, and auto-expand active section
const route = useRoute();
watch(() => route.path, (newPath) => {
  isSidebarOpen.value = false;
  // Automatically expand the active route's accordion if it hasn't been explicitly toggled
  if (expandedNavs.value[newPath] === undefined) {
    expandedNavs.value[newPath] = true;
  }
}, { immediate: true });

// Meta tags for help section
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - Help Center` : 'Help Center - Habits Social';
  }
});
</script>
