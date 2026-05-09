<template>
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
          <div class="overflow-y-auto flex-1 p-2">
            <div
              v-for="item in internalItems"
              :key="item.id"
              :data-id="item.id"
              draggable="true"
              @dragstart="onDragStart($event, item.id)"
              @dragover.prevent="onDragOver($event, item.id)"
              @drop.prevent="onDrop($event, item.id)"
              @dragend="onDragEnd"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all select-none"
              :class="[
                draggingId === item.id ? 'opacity-30' : 'opacity-100',
                dragOverId === item.id ? 'bg-zinc-700/60 ring-1 ring-white/20' : 'hover:bg-zinc-800/60'
              ]"
            >
              <div
                class="touch-none shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
                @touchstart.prevent="onGripTouchStart($event, item.id, '[data-id]')"
              >
                <GripVertical class="w-4 h-4" />
              </div>
              <span class="text-sm font-semibold text-zinc-200 truncate flex-1">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { GripVertical } from 'lucide-vue-next';
import { useSortableList } from '~/composables/useSortableList';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  items: any[];
}>();

const emit = defineEmits(['update:modelValue', 'reorder']);

// Local state for immediate UI feedback before parent updates
const internalItems = ref([...props.items]);
watch(() => props.items, (newItems) => {
  internalItems.value = [...newItems];
}, { deep: true });

const {
  draggingId,
  dragOverId,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onGripTouchStart
} = useSortableList(internalItems, (newOrderIds) => {
  emit('reorder', newOrderIds);
});
</script>
