<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div 
      v-motion 
      :initial="{ opacity: 0 }" 
      :enter="{ opacity: 1 }" 
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
      @click="close"
    ></div>

    <div 
      v-motion 
      :initial="{ opacity: 0, y: 20, scale: 0.95 }" 
      :enter="{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } }"
      class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
    >
      <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white" id="modal-title">
          {{ habit.id ? 'Edit Habit' : 'New Habit' }}
        </h3>
        <button @click="close" class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
          <input 
            v-model="editHabit.title" 
            type="text" 
            autoFocus
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-900 dark:text-white sm:text-sm outline-none"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in presetColors"
              :key="color"
              type="button"
              @click="editHabit.color = color"
              class="w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-transform hover:scale-110 cursor-pointer"
              :class="editHabit.color === color ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-110' : ''"
              :style="{ backgroundColor: color }"
            />
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button 
          v-if="habit.id"
          @click="onDelete"
          class="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash2 class="w-4 h-4" />
          Delete
        </button>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <button @click="close" class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            Cancel
          </button>
          <button @click="save" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X, Trash2 } from 'lucide-vue-next';
import type { Habit } from '~/composables/useHabitsApi';

const props = defineProps<{
  isOpen: boolean
  habit: Partial<Habit>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', habit: Partial<Habit>): void
  (e: 'delete', id: string): void
}>()

const presetColors = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', 
  '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', 
  '#a78bfa', '#e879f9', '#f43f5e'
];

const editHabit = ref<Partial<Habit>>({ ...props.habit })

watch(() => props.habit, (newHabit) => {
  editHabit.value = { ...newHabit }
}, { deep: true })

const close = () => {
  emit('close');
}

const save = () => {
  emit('save', editHabit.value);
}

const onDelete = () => {
  if (confirm("Are you sure you want to delete this habit?") && editHabit.value.id) {
    emit('delete', editHabit.value.id);
  }
}
</script>
