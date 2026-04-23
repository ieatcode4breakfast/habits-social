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

useHead({
  htmlAttrs: { class: 'dark' },
  title: 'Habits Social',
  meta: [
    { name: 'description', content: 'Track together, grow together' },
    { name: 'theme-color', content: '#080916' }
  ]
});
</script>
