<template>
  <div class="min-h-[100dvh] antialiased font-sans select-none">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :keepalive="{ include: ['social'] }" />
    </NuxtLayout>

    <!-- Global Toast Notification -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isVisible" class="fixed bottom-24 md:bottom-12 inset-x-0 mx-auto z-[200] flex items-center justify-center gap-2 px-4 py-2.5 w-max max-w-[calc(100vw-1rem)] bg-zinc-900/90 border border-white/10 rounded-2xl md:rounded-full backdrop-blur-xl shadow-2xl ring-1 ring-white/5 pointer-events-none">
          <div class="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg" :class="{
            'bg-emerald-500/20 text-emerald-500': type === 'completed',
            'bg-rose-500/20 text-rose-500': type === 'failed',
            'bg-zinc-500/20 text-zinc-400': type === 'skipped',
            'bg-zinc-800/50 text-zinc-600': type === 'cleared'
          }">
            <CheckIcon v-if="type === 'completed'" class="w-4 h-4" />
            <XIcon v-else-if="type === 'failed'" class="w-4 h-4" />
            <MinusIcon v-else-if="type === 'skipped'" class="w-4 h-4" />
          </div>
          <span class="text-sm font-bold tracking-tight text-white text-left">{{ message }}</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Check as CheckIcon, X as XIcon, Minus as MinusIcon } from 'lucide-vue-next';

const { isVisible, message, type } = useToast();
const { sync } = useHabitsApi();
const { user } = useAuth();
const { subscribeToUserSync } = useRealtime();
let unsubscribeSync: () => void = () => {};

onMounted(() => {
  // Purge any existing service workers that might be caching stale HTML/sessions
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        console.log('[System] Purging stale service worker:', registration.scope);
        registration.unregister();
      }
    });
  }
});

onUnmounted(() => {
  unsubscribeSync();
});

// Initial sync to hydrate the local database when user is logged in
watch(() => user.value?.id, (newId) => {
  if (newId && process.client) {
    console.log('[Offline First] User detected, starting initial sync...');
    sync();

    // Subscribe to real-time pushes indicating the server has settled
    unsubscribeSync();
    unsubscribeSync = subscribeToUserSync(newId, (eventName) => {
      if (eventName === 'sync-settled') {
        console.log('[Sync] Received sync-settled push event, triggering pull...');
        sync();
      }
    });
  } else {
    unsubscribeSync();
  }
}, { immediate: true });


useHead({
  htmlAttrs: { class: 'dark' },
  title: 'Habits Social',
  meta: [
    { name: 'description', content: 'A social habit tracking app.' },
    { name: 'theme-color', content: '#000000' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
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
