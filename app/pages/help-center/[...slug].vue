<template>
  <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 lg:p-10 transition-colors duration-200">
    <div class="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-emerald-600 dark:prose-a:text-emerald-400 hover:prose-a:text-emerald-700 dark:hover:prose-a:text-emerald-300">
      <ContentRenderer v-if="page" :value="page" />
      <div v-else class="text-center py-12">
        <h1 class="text-2xl font-bold mb-4">Page not found</h1>
        <p class="text-zinc-500 dark:text-zinc-400">The help article you are looking for does not exist.</p>
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
