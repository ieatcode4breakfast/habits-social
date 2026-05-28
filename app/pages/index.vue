<script setup lang="ts">
definePageMeta({
  middleware: [
    function () {
      return navigateTo('/habits', { redirectCode: 302 });
    }
  ]
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-zinc-950">
    <div class="animate-pulse flex flex-col items-center gap-3">
      <div class="w-12 h-12 rounded-full border-4 border-t-zinc-400 border-zinc-800 animate-spin"></div>
      <p class="text-zinc-500 text-sm font-medium tracking-tight">Redirecting to My Habits...</p>
    </div>
  </div>
</template>
