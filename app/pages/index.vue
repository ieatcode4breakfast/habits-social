<script setup lang="ts">
import { resolveStartupRoute } from '~/utils/startupRoute';

definePageMeta({
  layout: false,
  middleware: [
    async function () {
      const nuxtApp = useNuxtApp();
      const { user, fetchUser } = useAuth();

      if (!user.value) {
        await fetchUser();
      }

      if (!user.value) {
        return nuxtApp.runWithContext(() => navigateTo('/login', { replace: true }));
      }

      return nuxtApp.runWithContext(() =>
        navigateTo(resolveStartupRoute(import.meta.client ? navigator.onLine : true), { replace: true })
      );
    }
  ]
});
</script>

<template>
  <div key="index-page-root" class="min-h-screen bg-surface-muted" aria-hidden="true"></div>
</template>
