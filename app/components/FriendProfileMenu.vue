<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen && referenceEl"
        class="fixed inset-0 z-[190] touch-none"
        @click.stop="emit('close')"
        @wheel.stop.prevent
        @touchmove.stop.prevent
      >
        <div
          class="fixed inset-0 bg-transparent touch-none"
          @click.stop="emit('close')"
          @wheel.stop.prevent
          @touchmove.stop.prevent
        ></div>
        <div 
          ref="floatingRef"
          class="fixed z-[200] w-max max-w-[calc(100vw-1.25rem)] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1.5 min-w-[160px]"
          :style="floatingStyles"
          @click.stop
        >
          <button
            v-if="showShare"
            @click.stop="handleAction('share')"
            class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-3 cursor-pointer outline-none border border-transparent group"
          >
            <Share2 class="w-4 h-4 text-white group-hover:text-white" />
            <span class="text-sm font-semibold text-white">Share habits</span>
          </button>

          <button
            @click.stop="handleAction(isBlocked ? 'unblock' : 'block')"
            class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-3 cursor-pointer outline-none border border-transparent group"
            :class="isBlocked ? 'text-zinc-200' : 'text-rose-500 hover:text-rose-500'"
          >
            <ShieldBan class="w-4 h-4" :class="isBlocked ? 'text-zinc-400 group-hover:text-white' : 'text-rose-500 group-hover:text-rose-500'" />
            <span class="text-sm font-semibold">{{ isBlocked ? 'Unblock user' : 'Block user' }}</span>
          </button>

          <!-- Arrow -->
          <div 
            ref="arrowRef"
            class="absolute w-3 h-3 bg-zinc-900 border-r border-b border-zinc-800 rotate-45"
            :style="arrowStyles"
          ></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Share2, ShieldBan } from 'lucide-vue-next';
import { useFloating, offset, flip, shift, arrow, autoUpdate } from '@floating-ui/vue';

const props = defineProps<{
  referenceEl: HTMLElement | null;
  showShare: boolean;
  isBlocked: boolean;
}>();

const emit = defineEmits<{
  action: [type: 'share' | 'block' | 'unblock'];
  close: [];
}>();

const floatingRef = ref<HTMLElement | null>(null);
const arrowRef = ref<HTMLElement | null>(null);
const isOpen = computed(() => Boolean(props.referenceEl));

const { floatingStyles, middlewareData, placement, update } = useFloating(computed(() => props.referenceEl), floatingRef, {
  placement: 'bottom-end',
  strategy: 'fixed',
  transform: false,
  open: isOpen,
  middleware: [
    offset(12),
    flip(),
    shift({ padding: 10 }),
    arrow({ element: arrowRef })
  ],
  whileElementsMounted: autoUpdate
});

const arrowStaticSide = computed(() => {
  const basePlacement = placement.value.split('-')[0];
  if (basePlacement === 'bottom') return 'top';
  if (basePlacement === 'left') return 'right';
  if (basePlacement === 'right') return 'left';
  return 'bottom';
});

const arrowStyles = computed<Record<string, string>>(() => {
  const styles: Record<string, string> = {};
  if (middlewareData.value.arrow?.x != null) {
    styles.left = `${middlewareData.value.arrow.x}px`;
  }
  if (middlewareData.value.arrow?.y != null) {
    styles.top = `${middlewareData.value.arrow.y}px`;
  }
  styles[arrowStaticSide.value] = '-6px';
  return styles;
});

watch(
  () => [
    props.referenceEl,
    isOpen.value
  ] as const,
  async () => {
    if (!isOpen.value) return;
    await nextTick();
    update();
  },
  { flush: 'post' }
);

const handleAction = (type: 'share' | 'block' | 'unblock') => {
  emit('action', type);
  emit('close');
};
</script>
