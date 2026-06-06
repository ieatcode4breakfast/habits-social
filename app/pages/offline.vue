<template>
  <OfflineUnavailableContent :reason="reason" />
</template>

<script setup lang="ts">
import type { OfflineUnavailableReason } from '~/utils/offlineRoutes';

definePageMeta({
  middleware: []
});

const route = useRoute();
const reason = computed<OfflineUnavailableReason>(() => {
  return route.query.reason === 'session' ? 'session' : 'route';
});
</script>
