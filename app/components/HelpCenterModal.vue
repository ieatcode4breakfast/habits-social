<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div v-if="helpModal.isOpen.value" class="fixed inset-0 z-[100] bg-zinc-950 text-zinc-100 flex flex-col transition-colors duration-200 overflow-hidden">
        <!-- Top Header -->
        <header class="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
          <div class="flex items-center gap-3">
            <button @click="isSidebarOpen = true" class="p-2 -ml-2 rounded-lg hover:bg-zinc-900 transition-colors md:hidden">
              <MenuIcon class="w-6 h-6" />
            </button>
            <div class="flex items-center gap-2 group cursor-pointer" @click="helpModal.open('/help-center/welcome')">
              <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
                <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
              </div>
              <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400 hidden sm:inline">
                Habits Social
              </span>
              <span class="text-zinc-400 mx-1 hidden sm:inline">|</span>
              <span class="font-bold text-lg">Help Center</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="toggleThemeMode" class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" :title="themeToggleTitle">
              <MoonIcon v-if="isLightMode" class="w-5 h-5" />
              <SunIcon v-else class="w-5 h-5" />
            </button>
            <button @click="helpModal.close()" class="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors" title="Close Help Center">
              <XIcon class="w-5 h-5" />
            </button>
          </div>
        </header>

        <div class="flex flex-1 flex-col md:flex-row min-h-0 relative">
          <!-- Mobile Sidebar Backdrop -->
          <div 
            v-if="isSidebarOpen" 
            class="absolute inset-0 bg-black/50 z-40 md:hidden"
            @click="isSidebarOpen = false"
          ></div>

          <!-- Sidebar -->
          <aside 
            :class="[
              'absolute inset-y-0 left-0 z-50 md:z-20 w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:w-80 lg:w-[350px]',
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
                    <button 
                      class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group text-left"
                      :class="[
                        'px-4 py-2.5',
                        helpModal.activePath.value === link.path ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                      ]"
                      @click="() => { helpModal.open(link.path); isSidebarOpen = false; }"
                    >
                      <span class="truncate pr-2">{{ link.title || link.path.split('/').pop() }}</span>
                      <div 
                        v-if="link.body?.toc?.links?.length"
                        @click.prevent.stop="toggleAccordion(link.path)"
                        class="p-1 -mr-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <ChevronDown v-if="expandedNavs[link.path]" class="w-4 h-4" />
                        <ChevronRight v-else class="w-4 h-4" />
                      </div>
                    </button>

                    <!-- Subheaders Accordion -->
                    <div v-if="expandedNavs[link.path] && link.body?.toc?.links?.length" class="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-2">
                      <button
                        v-for="sublink in link.body.toc.links"
                        :key="sublink.id"
                        class="w-full text-left block px-2 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-800/50 truncate"
                        @click="() => { helpModal.open(link.path); scrollToHash(sublink.id); isSidebarOpen = false; }"
                      >
                        {{ sublink.text }}
                      </button>
                    </div>
                  </div>
                </template>
              </nav>
            </div>
          </aside>

          <!-- Main Content -->
          <main id="help-modal-main" class="flex-1 min-w-0 bg-black overflow-y-auto relative select-text">
            <div class="max-w-4xl mx-auto px-4 py-8 md:px-8 lg:px-12 pb-32">
              <HelpArticleViewer 
                :path="helpModal.activePath.value" 
                @reset="helpModal.open('/help-center/welcome')" 
              />
            </div>
          </main>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Menu as MenuIcon, X as XIcon, Sun as SunIcon, Moon as MoonIcon, ChevronDown, ChevronRight } from 'lucide-vue-next';
import { useThemeMode } from '~/composables/useThemeMode';
import { useHelpModal } from '~/composables/useHelpModal';
import { useModalHistory } from '~/composables/useModalHistory';

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();
const helpModal = useHelpModal();
const isSidebarOpen = ref(false);

const { data: navigation, pending, error } = await useAsyncData('help-navigation-modal', async () => {
  const docs = await queryCollection('docs').select('title', 'path', 'order', 'body').all();
  return docs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
});

const expandedNavs = ref<Record<string, boolean>>({});

function toggleAccordion(path: string) {
  expandedNavs.value[path] = !expandedNavs.value[path];
}

useModalHistory(helpModal.isOpen);

watch(() => helpModal.activePath.value, (newPath) => {
  if (expandedNavs.value[newPath] === undefined) {
    expandedNavs.value[newPath] = true;
  }
  
  if (import.meta.client) {
    const main = document.getElementById('help-modal-main');
    if (main) main.scrollTop = 0;
  }
}, { immediate: true });

function scrollToHash(id: string) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}
</script>
