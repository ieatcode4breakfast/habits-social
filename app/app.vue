<template>
  <div class="min-h-[100dvh] antialiased font-sans select-none"><VitePwaManifest /><ClientOnly><NuxtRouteAnnouncer /></ClientOnly><NuxtLayout><NuxtPage :keepalive="{ include: ['social', 'inbox'] }" /></NuxtLayout><HelpCenterModal /><ClientOnly><Teleport to="body"><Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-4 scale-95" enter-to-class="opacity-100 translate-y-0 scale-100" leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95"><div v-if="isVisible" class="fixed bottom-24 md:bottom-12 inset-x-0 mx-auto z-[200] flex items-center justify-center gap-2 px-4 py-2.5 w-max max-w-[calc(100vw-1rem)] bg-surface-solid/90 border border-fg/10 rounded-2xl md:rounded-full backdrop-blur-xl shadow-2xl ring-1 ring-fg/5 pointer-events-none"><div class="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg" :class="{'bg-emerald-500/20 text-emerald-500': type === 'completed', 'bg-rose-500/20 text-rose-500': type === 'failed', 'bg-zinc-500/20 text-fg-muted': type === 'skipped', 'bg-surface-hover/50 text-fg-subtle': type === 'cleared'}"><CheckIcon v-if="type === 'completed'" class="w-4 h-4" /><XIcon v-else-if="type === 'failed'" class="w-4 h-4" /><MinusIcon v-else-if="type === 'skipped'" class="w-4 h-4" /><Trash2Icon v-else-if="type === 'cleared'" class="w-4 h-4" /></div><span class="text-sm font-bold tracking-tight text-fg text-center">{{ message }}</span></div></Transition></Teleport></ClientOnly></div>
</template>

<script setup lang="ts">
import { Check as CheckIcon, X as XIcon, Minus as MinusIcon, Trash2 as Trash2Icon } from 'lucide-vue-next';

const { isVisible, message, type } = useToast();
const config = useRuntimeConfig();
const { sync } = useHabitsApi();
const { user, flushPendingLogout } = useAuth();
const { themeMode, initializeThemeMode } = useThemeMode();

const { isOnline } = useNetwork();
const { showToast } = useToast();
const route = useRoute();

useFocusRefetch(sync);

onMounted(() => {
  initializeThemeMode();
  if (isOnline.value) {
    void flushPendingLogout();
  }
});

// Watch connectivity for UI feedback and auto-sync
watch(isOnline, async (online) => {
  if (!online) {
    showToast('You are offline. Changes will be saved locally. Some features may not be available.', 'failed');
  } else {
    await flushPendingLogout();
    showToast('Back online! Syncing changes...', 'completed');
    if (user.value?.id) {
      sync();
    }
  }
});

// Initial sync
watch(() => user.value?.id, (newId) => {
  if (newId && import.meta.client) {
    console.log('[Sync] User session active, starting hydration...');
    sync();
  }
}, { immediate: true });


useHead(() => ({
  htmlAttrs: { class: themeMode.value, style: 'overscroll-behavior-y: none' },
  bodyAttrs: { style: 'overscroll-behavior-y: none' },
  title: 'Habits Social',
  meta: [
    { name: 'description', content: 'A social habit tracking app.' },
    { name: 'theme-color', content: themeMode.value === 'light' ? '#f6f7fb' : '#000000' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: config.public.appName as string },
    { property: 'og:title', content: 'Habits Social' },
    { property: 'og:description', content: 'A social habit tracking app.' },
    { name: 'twitter:title', content: 'Habits Social' },
    { name: 'twitter:description', content: 'A social habit tracking app.' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon-rounded.svg?v=15' },
    { rel: 'apple-touch-icon', href: '/favicon-rounded.svg' }
  ]
}));
</script>
