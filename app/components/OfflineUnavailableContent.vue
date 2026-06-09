<template>
  <div class="fixed inset-0 md:top-[57px] z-40 bg-zinc-950 overflow-y-auto select-none flex flex-col">
    <div class="flex-1 flex items-center justify-center px-4 py-12 pb-24 md:pb-12">
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-8 relative overflow-hidden">
      <div class="absolute -top-20 -left-20 w-40 h-40 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="text-center space-y-4 relative">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/30 mb-2 relative">
          <Wifi v-if="isOnlineMounted" class="w-8 h-8 text-emerald-400" />
          <WifiOff v-else class="w-8 h-8 text-zinc-500" />

          <div v-if="isOnlineMounted" class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900"></div>
          <div v-else class="absolute -top-1 -right-1 w-3 h-3 bg-zinc-650 rounded-full border-2 border-zinc-900"></div>
        </div>

        <h1 class="text-2xl font-bold tracking-tight text-white">
          {{ isSessionReason ? 'Offline sign-in required' : 'This page is not available offline' }}
        </h1>

        <p class="text-zinc-400 text-sm leading-relaxed">
          {{
            isSessionReason
              ? 'You need an internet connection to sign in before offline access is available on this device.'
              : 'Habits and Buckets are available offline. Social, Inbox, profiles, account actions, and support pages need a connection.'
          }}
        </p>

        <div v-if="isOnlineMounted" class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-emerald-400 text-xs font-semibold">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Your internet connection has returned
        </div>
      </div>

      <div class="space-y-3 pt-2">
        <template v-if="isSessionReason">
          <NuxtLink
            to="/login"
            :class="[
              'w-full py-3 flex items-center justify-center gap-2 font-semibold rounded-xl transition-all text-sm border shadow-lg cursor-pointer active:scale-[0.98]',
              isOnlineMounted
                ? 'bg-white hover:bg-zinc-200 text-black border-white shadow-white/5'
                : 'bg-zinc-850 text-zinc-500 border-zinc-800 shadow-none cursor-not-allowed opacity-50'
            ]"
            :style="!isOnlineMounted ? 'pointer-events: none;' : ''"
          >
            <LogIn class="w-4 h-4" />
            Try again online
          </NuxtLink>
        </template>

        <template v-else-if="hasOfflineSessionMounted">
          <div class="grid grid-cols-2 gap-3">
            <NuxtLink
              to="/habits"
              class="py-3 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-semibold rounded-xl transition-all border border-zinc-700/50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <ListChecks class="w-4 h-4 text-zinc-400" />
              Habits
            </NuxtLink>
            <NuxtLink
              to="/buckets"
              class="py-3 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-semibold rounded-xl transition-all border border-zinc-700/50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <PaintBucket class="w-4 h-4 text-zinc-400" />
              Buckets
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { Wifi, WifiOff, ListChecks, PaintBucket, LogIn } from 'lucide-vue-next';
import { hasCachedAuthUser } from '~/utils/cachedAuth';

const props = defineProps<{
  reason?: 'route' | 'session';
}>();

const { isOnline } = useNetwork();
const isOnlineMounted = ref(true);
const hasOfflineSessionMounted = ref(false);

onMounted(() => {
  isOnlineMounted.value = isOnline.value;
  hasOfflineSessionMounted.value = !!user.value?.id || hasCachedAuthUser(localStorage);
});

watch(isOnline, (val) => {
  isOnlineMounted.value = val;
});

watch(() => user.value?.id, (newId) => {
  hasOfflineSessionMounted.value = !!newId || (import.meta.client && hasCachedAuthUser(localStorage));
});

const { user } = useAuth();

const isSessionReason = computed(() => props.reason === 'session');
</script>
