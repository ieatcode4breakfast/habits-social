<template>
  <div class="h-[100dvh] overflow-hidden bg-surface-muted text-fg flex flex-col transition-colors duration-200">
    <header class="flex items-center justify-between p-4 border-b border-border-muted bg-surface-muted/80 backdrop-blur-md sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="p-2 -ml-2 rounded-lg hover:bg-surface-solid transition-colors md:hidden"
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
            <img :src="'/icons/icon-192.png'" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fg to-fg-muted hidden sm:inline">
            Habits Social
          </span>
          <span class="text-fg-muted mx-1 hidden sm:inline">|</span>
          <span :id="titleId" class="font-bold text-lg">Help Center</span>
        </button>

        <NuxtLink v-else to="/help-center/welcome" class="flex items-center gap-2 group">
          <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
            <img :src="'/icons/icon-192.png'" class="w-full h-full object-contain" alt="Logo" />
          </div>
          <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fg to-fg-muted hidden sm:inline">
            Habits Social
          </span>
          <span class="text-fg-muted mx-1 hidden sm:inline">|</span>
          <span :id="titleId" class="font-bold text-lg">Help Center</span>
        </NuxtLink>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-cell-markable-hover transition-colors"
          :title="themeToggleTitle"
          :aria-label="themeToggleTitle"
          @click="toggleThemeMode"
        >
          <SunIcon v-if="isLightMode" class="w-5 h-5" />
          <MoonIcon v-else class="w-5 h-5" />
        </button>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-surface-solid transition-colors"
          :aria-label="mode === 'modal' ? 'Close help center' : 'Return to app'"
          @click="emit('close')"
        >
          <XIcon v-if="mode === 'modal'" class="w-5 h-5" />
          <ArrowLeftIcon v-else class="w-5 h-5" />
        </button>
      </div>
    </header>

    <div class="flex flex-1 flex-col md:flex-row min-h-0 overflow-hidden">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <aside
        :class="[
          'fixed inset-y-0 left-0 z-50 md:z-20 w-80 max-w-[85vw] bg-surface-muted border-r border-border-muted transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-[65px] md:h-[calc(100dvh-65px)] md:self-start md:w-80 lg:w-[350px]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ]"
      >
        <div class="h-full flex flex-col">
          <div class="p-4 flex items-center justify-between border-b border-border-muted md:hidden">
            <span class="font-bold text-lg">Help Center</span>
            <button
              type="button"
              class="p-2 -mr-2 rounded-lg hover:bg-surface-solid transition-colors"
              aria-label="Close help navigation"
              @click="isSidebarOpen = false"
            >
              <XIcon class="w-6 h-6" />
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto p-4 space-y-1">
            <div v-if="pending" class="px-3 py-2 text-sm text-fg-subtle">Loading...</div>
            <div v-else-if="error" class="px-3 py-2 text-sm text-rose-500">Error loading navigation</div>

            <template v-else>
              <div v-for="link in navigationLinks" :key="link.path" class="mb-1">
                <div
                  class="flex items-center rounded-lg transition-colors"
                  :class="currentArticlePath === link.path ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-solid'"
                >
                  <button
                    v-if="mode === 'modal'"
                    type="button"
                    class="min-w-0 flex-1 text-left px-4 py-2.5 text-sm"
                    @click="navigateInModal(link.path)"
                  >
                    <span class="block truncate pr-2">{{ link.title }}</span>
                  </button>

                  <NuxtLink
                    v-else
                    :to="link.path"
                    class="min-w-0 flex-1 px-4 py-2.5 text-sm"
                    @click="isSidebarOpen = false"
                  >
                    <span class="block truncate pr-2">{{ link.title }}</span>
                  </NuxtLink>

                  <button
                    v-if="link.tocLinks.length"
                    type="button"
                    class="p-2 mr-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
                    :aria-expanded="isExpanded(link.path)"
                    :aria-label="isExpanded(link.path) ? `Hide ${link.title} subheaders` : `Show ${link.title} subheaders`"
                    @click="toggleAccordion(link.path)"
                  >
                    <ChevronDown v-if="isExpanded(link.path)" class="w-4 h-4" />
                    <ChevronRight v-else class="w-4 h-4" />
                  </button>
                </div>

                <div v-if="isExpanded(link.path) && link.tocLinks.length" class="ml-4 mt-1 space-y-1 border-l border-border-muted pl-2">
                  <template v-for="tocLink in link.tocLinks" :key="tocLink.id">
                    <button
                      v-if="mode === 'modal'"
                      type="button"
                      class="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-fg-muted transition-colors hover:bg-surface-hover/50 hover:text-fg"
                      @click="navigateInModal(`${link.path}#${tocLink.id}`)"
                    >
                      {{ tocLink.text }}
                    </button>

                    <NuxtLink
                      v-else
                      :to="`${link.path}#${tocLink.id}`"
                      class="block truncate rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover/50 hover:text-fg"
                      @click="isSidebarOpen = false"
                    >
                      {{ tocLink.text }}
                    </NuxtLink>
                  </template>
                </div>
              </div>
            </template>
          </nav>
        </div>
      </aside>

      <main class="flex-1 min-w-0 bg-surface-muted overflow-y-auto">
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
import { useAsyncData, useHead } from '#app';
import { queryCollection } from '#imports';
import { ArrowLeft as ArrowLeftIcon, ChevronDown, ChevronRight, Menu as MenuIcon, Moon as MoonIcon, Sun as SunIcon, X as XIcon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { DEFAULT_HELP_PATH, getHelpArticlePath, type HelpCenterMode } from '~/utils/helpCenter';
import { useThemeMode } from '~/composables/useThemeMode';
import HelpArticleViewer from './HelpArticleViewer.vue';

interface HelpNavigationLink {
  path: string;
  title: string;
  tocLinks: HelpTocLink[];
}

interface HelpTocLink {
  id: string;
  text: string;
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
const expandedNavs = ref<Record<string, boolean>>({});
const currentArticlePath = computed(() => getHelpArticlePath(props.activePath));

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getTocLinks = (body: unknown): HelpTocLink[] => {
  if (!isRecord(body) || !isRecord(body.toc) || !Array.isArray(body.toc.links)) return [];

  return body.toc.links.flatMap((link) => {
    if (!isRecord(link) || typeof link.id !== 'string' || typeof link.text !== 'string') return [];
    return [{ id: link.id, text: link.text }];
  });
};

const { data: navigation, pending, error } = useAsyncData('help-navigation', async () => {
  const docs = await queryCollection('docs').select('title', 'path', 'order', 'body').all();
  return docs
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((doc) => ({
      path: doc.path,
      title: doc.title || doc.path.split('/').pop() || doc.path,
      tocLinks: getTocLinks(doc.body)
    }));
});

const navigationLinks = computed<HelpNavigationLink[]>(() => navigation.value ?? []);

const navigateInModal = (path: string) => {
  isSidebarOpen.value = false;
  emit('navigate', path);
};

const isExpanded = (path: string) => expandedNavs.value[path] === true;

const toggleAccordion = (path: string) => {
  expandedNavs.value[path] = !isExpanded(path);
};

watch(currentArticlePath, () => {
  isSidebarOpen.value = false;
  if (expandedNavs.value[currentArticlePath.value] === undefined) {
    expandedNavs.value[currentArticlePath.value] = true;
  }
}, { immediate: true });

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - Help Center` : 'Help Center - Habits Social';
  }
});
</script>
