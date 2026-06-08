<template>
  <div class="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col transition-colors duration-200">
    <header class="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="p-2 -ml-2 rounded-lg hover:bg-zinc-900 transition-colors md:hidden"
          aria-label="Open help navigation"
          @click="isSidebarOpen = true"
        >
          <MenuIcon class="w-6 h-6" />
        </button>

        <button
          v-if="mode === 'modal'"
          type="button"
          class="flex items-center gap-2 group text-left"
          @click="emit('navigate', DEFAULT_HELP_PATH)"
        >
          <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
            <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400 hidden sm:inline">
            Habits Social
          </span>
          <span class="text-zinc-400 mx-1 hidden sm:inline">|</span>
          <span :id="titleId" class="font-bold text-lg">Help Center</span>
        </button>

        <NuxtLink v-else to="/help-center/welcome" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
            <img src="/icons/icon-192.png" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-400 hidden sm:inline">
            Habits Social
          </span>
          <span class="text-zinc-400 mx-1 hidden sm:inline">|</span>
          <span :id="titleId" class="font-bold text-lg">Help Center</span>
        </NuxtLink>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          :title="themeToggleTitle"
          :aria-label="themeToggleTitle"
          @click="toggleThemeMode"
        >
          <SunIcon v-if="isLightMode" class="w-5 h-5" />
          <MoonIcon v-else class="w-5 h-5" />
        </button>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-zinc-900 transition-colors"
          :aria-label="mode === 'modal' ? 'Close help center' : 'Return to app'"
          @click="emit('close')"
        >
          <XIcon v-if="mode === 'modal'" class="w-5 h-5" />
          <ArrowLeftIcon v-else class="w-5 h-5" />
        </button>
      </div>
    </header>

    <div class="flex flex-1 flex-col md:flex-row min-h-0">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <aside
        :class="[
          'fixed inset-y-0 left-0 z-50 md:z-20 w-80 max-w-[85vw] bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-[65px] md:h-[calc(100dvh-65px)] md:self-start md:w-80 lg:w-[350px]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ]"
      >
        <div class="h-full flex flex-col">
          <div class="p-4 flex items-center justify-between border-b border-zinc-800 md:hidden">
            <span class="font-bold text-lg">Help Center</span>
            <button
              type="button"
              class="p-2 -mr-2 rounded-lg hover:bg-zinc-900 transition-colors"
              aria-label="Close help navigation"
              @click="isSidebarOpen = false"
            >
              <XIcon class="w-6 h-6" />
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto p-4 space-y-1">
            <div v-if="pending" class="px-3 py-2 text-sm text-zinc-500">Loading...</div>
            <div v-else-if="error" class="px-3 py-2 text-sm text-rose-500">Error loading navigation</div>

            <template v-else>
              <template v-for="link in navigationLinks" :key="link.path">
                <button
                  v-if="mode === 'modal'"
                  type="button"
                  class="w-full text-left flex items-center justify-between px-4 py-2.5 text-sm transition-colors rounded-lg"
                  :class="currentArticlePath === link.path ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'"
                  @click="navigateInModal(link.path)"
                >
                  <span class="truncate pr-2">{{ link.title }}</span>
                </button>

                <NuxtLink
                  v-else
                  :to="link.path"
                  class="block px-4 py-2.5 text-sm transition-colors rounded-lg"
                  active-class="bg-emerald-500/10 text-emerald-400 font-medium"
                  :class="currentArticlePath === link.path ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'"
                  @click="isSidebarOpen = false"
                >
                  <span class="truncate pr-2">{{ link.title }}</span>
                </NuxtLink>
              </template>
            </template>
          </nav>
        </div>
      </aside>

      <main class="flex-1 min-w-0 bg-black">
        <div class="max-w-4xl mx-auto px-4 py-8 md:px-8 lg:px-12">
          <HelpArticleViewer
            :path="activePath"
            :mode="mode"
            @navigate="path => emit('navigate', path)"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft as ArrowLeftIcon, Menu as MenuIcon, Moon as MoonIcon, Sun as SunIcon, X as XIcon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { DEFAULT_HELP_PATH, getHelpArticlePath, type HelpCenterMode } from '~/utils/helpCenter';
import { useThemeMode } from '~/composables/useThemeMode';

interface HelpNavigationLink {
  path: string;
  title: string;
}

interface HelpNavigationItem {
  path?: string;
  title?: string;
  children?: HelpNavigationItem[];
}

const props = withDefaults(defineProps<{
  mode: HelpCenterMode;
  activePath: string;
  titleId?: string;
}>(), {
  titleId: undefined
});

const emit = defineEmits<{
  close: [];
  navigate: [path: string];
}>();

const { isLightMode, themeToggleTitle, toggleThemeMode } = useThemeMode();
const isSidebarOpen = ref(false);
const currentArticlePath = computed(() => getHelpArticlePath(props.activePath));

const flattenNavigation = (items: HelpNavigationItem[]): HelpNavigationLink[] => {
  return items.flatMap((item) => {
    const children = item.children ? flattenNavigation(item.children) : [];
    if (!item.path || !item.path.startsWith('/help-center/')) return children;

    return [
      {
        path: item.path,
        title: item.title || item.path.split('/').pop() || item.path
      },
      ...children
    ];
  });
};

const { data: navigation, pending, error } = await useAsyncData('help-navigation', async () => {
  const items = await queryCollectionNavigation('docs', ['order']).order('order', 'ASC');
  return flattenNavigation(items);
});

const navigationLinks = computed<HelpNavigationLink[]>(() => navigation.value ?? []);

const navigateInModal = (path: string) => {
  isSidebarOpen.value = false;
  emit('navigate', path);
};

watch(currentArticlePath, () => {
  isSidebarOpen.value = false;
}, { immediate: true });

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - Help Center` : 'Help Center - Habits Social';
  }
});
</script>
