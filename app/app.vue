<template>
  <div class="min-h-screen antialiased font-sans select-none">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const { fetchUser } = useAuth();
await fetchUser();

useHead({
  htmlAttrs: { class: 'dark' },
  title: 'Habits Social',
  meta: [
    { name: 'description', content: 'Track together, grow together' },
    { name: 'theme-color', content: '#080916' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Habits Social' }
  ],
  link: [
    { rel: 'manifest', href: '/manifest.json?v=11' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-rounded.svg?v=11' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png?v=11' }
  ]
});
</script>
