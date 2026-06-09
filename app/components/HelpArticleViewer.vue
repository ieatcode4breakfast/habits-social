<template>
  <div
    ref="contentRoot"
    class="prose max-w-none prose-headings:font-bold prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-pre:bg-transparent prose-hr:border-zinc-800 custom-prose-theme"
    @click.capture="handleContentClick"
  >
    <ContentRenderer v-if="page" :value="page" />
    <div v-else class="text-center py-12">
      <h1 class="text-2xl font-bold mb-4 text-white">Article Not Found</h1>
      <p class="text-zinc-400">The help article you are looking for does not exist.</p>
      <NuxtLink
        v-if="mode === 'page'"
        to="/help-center"
        class="inline-block mt-6 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors no-underline"
      >
        Go to Help Center
      </NuxtLink>
      <button
        v-else
        type="button"
        class="inline-block mt-6 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors no-underline"
        @click="emit('navigate', DEFAULT_HELP_PATH)"
      >
        Go to Help Center
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useHelpArticle } from '~/composables/useHelpArticle';
import { DEFAULT_HELP_PATH, getHelpPathHash, parseHelpPath, type HelpCenterMode } from '~/utils/helpCenter';

const props = defineProps<{
  path: string;
  mode: HelpCenterMode;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const contentRoot = ref<HTMLElement | null>(null);
const { data: page } = await useHelpArticle(() => props.path);

const getAnchorFromEvent = (event: MouseEvent): HTMLAnchorElement | null => {
  if (!(event.target instanceof Element)) return null;
  return event.target.closest('a[href]');
};

const isPlainLeftClick = (event: MouseEvent) => {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
};

const shouldIgnoreAnchor = (anchor: HTMLAnchorElement) => {
  const target = anchor.getAttribute('target');
  return anchor.hasAttribute('download') || Boolean(target && target !== '_self');
};

const scrollToHash = async (hash: string) => {
  if (!import.meta.client || !hash) return;

  await nextTick();

  let targetId: string;
  try {
    targetId = decodeURIComponent(hash.slice(1));
  } catch {
    targetId = hash.slice(1);
  }

  const target = Array.from(contentRoot.value?.querySelectorAll<HTMLElement>('[id]') ?? [])
    .find((element) => element.id === targetId);

  target?.scrollIntoView({ block: 'start' });
};

const handleContentClick = (event: MouseEvent) => {
  if (props.mode !== 'modal' || !isPlainLeftClick(event)) return;

  const anchor = getAnchorFromEvent(event);
  if (!anchor || shouldIgnoreAnchor(anchor)) return;

  const href = anchor.getAttribute('href');
  if (!href) return;

  if (href.startsWith('#')) {
    event.preventDefault();
    void scrollToHash(href);
    return;
  }

  const nextPath = parseHelpPath(href);
  if (!nextPath) return;

  event.preventDefault();
  emit('navigate', nextPath.fullPath);
};

watch(
  () => [props.path, page.value] as const,
  () => {
    void scrollToHash(getHelpPathHash(props.path));
  },
  { flush: 'post' }
);
</script>

<style scoped>
.custom-prose-theme {
  --tw-prose-body: var(--color-zinc-300);
  --tw-prose-headings: var(--color-white);
  --tw-prose-lead: var(--color-zinc-400);
  --tw-prose-links: var(--color-emerald-400);
  --tw-prose-bold: var(--color-white);
  --tw-prose-counters: var(--color-zinc-400);
  --tw-prose-bullets: var(--color-zinc-500);
  --tw-prose-hr: var(--color-zinc-800);
  --tw-prose-quotes: var(--color-white);
  --tw-prose-quote-borders: var(--color-zinc-800);
  --tw-prose-captions: var(--color-zinc-400);
  --tw-prose-code: var(--color-white);
  --tw-prose-pre-code: var(--color-zinc-200);
  --tw-prose-pre-bg: transparent;
  --tw-prose-th-borders: var(--color-zinc-800);
  --tw-prose-td-borders: var(--color-zinc-800);
}

:deep(h1 a),
:deep(h2 a),
:deep(h3 a),
:deep(h4 a),
:deep(h5 a),
:deep(h6 a) {
  text-decoration: none !important;
  color: inherit !important;
  font-weight: inherit !important;
}

:deep(a) {
  text-decoration: none;
}

:deep(h2),
:deep(h3),
:deep(h4) {
  scroll-margin-top: 2rem;
}

:deep(p:has(> a:only-child)) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(p > a:only-child) {
  display: inline-block;
}

:deep(blockquote p::before),
:deep(blockquote p::after) {
  content: none !important;
}
</style>
