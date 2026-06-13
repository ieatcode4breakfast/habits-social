<template>
  <div class="fixed inset-0 md:top-[57px] z-40 bg-surface-muted overflow-y-auto select-none flex flex-col">
    <div class="flex-1 flex items-center justify-center px-4 py-12 pb-24 md:pb-12">
      <div class="w-full max-w-md bg-surface-solid border border-border-muted rounded-3xl p-8 space-y-8 relative overflow-hidden">
      <div class="absolute -top-20 -left-20 w-40 h-40 bg-surface-hover/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="text-center space-y-4 relative">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-hover/50 border border-border-strong/30 mb-2 relative">
          <Wifi v-if="isOnlineMounted" class="w-8 h-8 text-emerald-400" />
          <WifiOff v-else class="w-8 h-8 text-fg-subtle" />

          <div v-if="isOnlineMounted" class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-solid"></div>
          <div v-else class="absolute -top-1 -right-1 w-3 h-3 bg-fg-subtle rounded-full border-2 border-surface-solid"></div>
        </div>

        <h1 class="text-2xl font-bold tracking-tight text-fg">
          {{ isSessionReason ? 'Offline sign-in required' : 'This page is not available offline' }}
        </h1>

        <p class="text-fg-muted text-sm leading-relaxed">
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
                ? 'bg-action-primary hover:bg-action-primary-hover text-action-primary-fg border-fg shadow-fg-inverted/5'
                : 'bg-surface-solid text-fg-subtle border-border-muted shadow-none cursor-not-allowed opacity-50'
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
              class="py-3 px-4 bg-surface-hover hover:bg-surface-hover text-fg font-semibold rounded-xl transition-all border border-border-strong/50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <ListChecks class="w-4 h-4 text-fg-muted" />
              Habits
            </NuxtLink>
            <NuxtLink
              to="/buckets"
              class="py-3 px-4 bg-surface-hover hover:bg-surface-hover text-fg font-semibold rounded-xl transition-all border border-border-strong/50 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <PaintBucket class="w-4 h-4 text-fg-muted" />
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
