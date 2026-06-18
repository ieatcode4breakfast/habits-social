<template>
  <div
    v-if="visible"
    class="mx-2 mt-2 mb-0 px-3 py-2 bg-surface-solid border border-border-muted/80 rounded-xl flex items-center justify-between gap-2 shrink-0"
  >
    <div class="flex-1 min-w-0">
      <p class="text-xs font-bold text-fg truncate">Get notified</p>
      <p class="text-[10px] text-fg-subtle leading-tight">Enable notifications for new messages and friend requests</p>
    </div>
    <button
      @click="enable"
      :disabled="disabled"
      class="px-3 py-1.5 text-[11px] font-bold bg-action-primary hover:bg-action-primary-hover text-action-primary-fg rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1"
    >
      <template v-if="disabled && isSubscribing">
        <div class="w-3 h-3 border-2 border-fg/20 border-t-white rounded-full animate-spin"></div>
        Enabling...
      </template>
      <template v-else>
        Enable
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useChatNotifications } from '~/composables/useChatNotifications';
import { useToast } from '~/composables/useToast';
import { useNetwork } from '@vueuse/core';

const { canSubscribe, isSubscribing, isSubscribed, init: initPush, requestPermission } = useChatNotifications();
const { showToast } = useToast();
const { isOnline } = useNetwork();

const visible = computed(() => canSubscribe.value && !isSubscribed.value);
const disabled = computed(() => isSubscribing.value);

const enable = async () => {
  const ok = await requestPermission();
  if (!ok) {
    showToast('Could not enable notifications. Check browser settings.', 'failed');
  }
};

onMounted(async () => {
  if (isOnline.value) {
    await initPush();
  }
});
</script>
