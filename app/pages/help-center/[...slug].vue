<template>
  <div>
    <div class="prose max-w-none prose-headings:font-bold prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-pre:bg-transparent prose-hr:border-zinc-800 custom-prose-theme">
      <ContentRenderer v-if="page" :value="page" />
      <div v-else class="text-center py-12">
        <h1 class="text-2xl font-bold mb-4 text-white">Article Not Found</h1>
        <p class="text-zinc-400">The help article you are looking for does not exist.</p>
        <NuxtLink to="/help-center" class="inline-block mt-6 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors no-underline">
          Go to Help Center
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { data: page } = await useHelpArticle(() => route.path);
</script>

<style scoped>
/* Map Tailwind Typography variables to dynamic app CSS variables */
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

:deep(blockquote p::before),
:deep(blockquote p::after) {
  content: none !important;
}
</style>
