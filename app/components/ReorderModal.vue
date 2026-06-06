<template>
  <ClientOnly>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue" class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:p-4 p-0 sm:py-8">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="$emit('update:modelValue', false)"></div>

        <!-- Modal Content -->
        <div class="relative my-auto w-full sm:max-w-sm bg-zinc-925 border-t sm:border border-zinc-800 sm:rounded-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style="max-height: 80vh">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
            <div>
              <h2 class="text-base font-bold text-white">{{ title }}</h2>
              <p class="text-[11px] text-zinc-500 mt-0.5">Drag to rearrange</p>
            </div>
            <button
              @click="$emit('update:modelValue', false)"
              class="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          </div>

          <!-- List -->
          <div class="overflow-y-auto flex-1 p-2" ref="sortableContainer">
            <div
              v-for="item in internalItems"
              :key="item.id"
              :data-id="item.id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors select-none hover:bg-zinc-800/60 bg-zinc-925 sortable-item cursor-grab active:cursor-grabbing"
            >
              <div class="shrink-0 text-zinc-500 transition-colors">
                <GripVertical class="w-4 h-4" />
              </div>
              <span class="text-sm font-semibold text-zinc-200 truncate flex-1">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { GripVertical } from 'lucide-vue-next';
import { useSortable } from '@vueuse/integrations/useSortable';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  items: any[];
}>();

const emit = defineEmits(['update:modelValue', 'reorder']);

// Local state for immediate UI feedback before parent updates
const internalItems = ref([...props.items]);

// Only pull fresh data from the parent when the modal is opened
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    internalItems.value = [...props.items];
  }
});

const sortableContainer = ref<HTMLElement | null>(null);

useSortable(sortableContainer, internalItems, {
  watchElement: true,
  draggable: '.sortable-item',
  animation: 250,
  delay: 200,
  delayOnTouchOnly: true,
  touchStartThreshold: 5,
  ghostClass: 'opacity-0',
  dragClass: 'scale-105',
  forceFallback: true,
  fallbackClass: 'sortable-fallback-opaque',
  fallbackOnBody: true,
  onEnd: async () => {
    await nextTick();
    emit('reorder', internalItems.value.map(i => i.id));
  }
});
</script>

<style>
.sortable-fallback-opaque {
  opacity: 1 !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
  cursor: grabbing !important;
  z-index: 9999 !important;
  scale: 1.02 !important;
}
</style>
