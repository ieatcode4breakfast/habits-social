<script setup lang="ts">
import { resolveStartupRoute } from '~/utils/startupRoute';

definePageMeta({
  layout: false,
  middleware: [
    function () {
      if (import.meta.server) {
        return;
      }

      return navigateTo(resolveStartupRoute(navigator.onLine), { replace: true });
    }
  ]
});
</script>

<template>
  <div key="index-page-root" class="min-h-screen flex items-center justify-center bg-zinc-950">
    <div class="animate-pulse flex flex-col items-center gap-3">
      <div class="w-12 h-12 rounded-full border-4 border-t-zinc-400 border-zinc-800 animate-spin"></div>
      <p class="text-zinc-500 text-sm font-medium tracking-tight">Opening app...</p>
    </div>
  </div>
</template>
