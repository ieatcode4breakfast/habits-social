<template>
  <div class="min-h-screen antialiased font-sans">
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
