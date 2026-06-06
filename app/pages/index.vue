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
  <div key="index-page-root" class="min-h-screen bg-zinc-950" aria-hidden="true"></div>
</template>
