<template>
  <div class="h-full antialiased font-sans">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const { fetchUser } = useAuth();
await callOnce(fetchUser);
</script>

<style>
/* Using global css instead */
</style>
