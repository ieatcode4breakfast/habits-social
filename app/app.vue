<template>
  <div class="min-h-[100dvh] antialiased font-sans select-none">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const { fetchUser } = useAuth();
await fetchUser();

onMounted(() => {
  // Nuclear option: Unregister any stale service workers that might be causing the redirect crash
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
});

useHead({
  htmlAttrs: { class: 'dark' },
  title: 'Habits Social',
  meta: [
    { name: 'description', content: 'A social habit tracking app.' },
    { name: 'theme-color', content: '#080916' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Habits Social' },
    { property: 'og:title', content: 'Habits Social' },
    { property: 'og:description', content: 'A social habit tracking app.' },
    { name: 'twitter:title', content: 'Habits Social' },
    { name: 'twitter:description', content: 'A social habit tracking app.' }
  ],
  link: [
    { rel: 'manifest', href: '/manifest.json?v=15' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-rounded.svg?v=15' },
    { rel: 'apple-touch-icon', href: '/favicon-rounded.svg' }
  ]
});
</script>
