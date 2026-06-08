<template>
  <div class="min-h-screen bg-zinc-950" aria-hidden="true"></div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [
    () => navigateTo('/help-center/welcome', { replace: true })
  ]
});
</script>
