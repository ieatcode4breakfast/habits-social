<template>
  <ClientOnly>
    <Teleport to="body">
    <!-- Overlay -->
    <Transition
      enter-active-class="transition-none"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md touch-none"
        @click="handleOverlayClick"
      ></div>
    </Transition>

    <!-- Content -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue" class="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0">
        <div 
          class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-surface-raised border-x-0 sm:border border-border-muted sm:rounded-3xl rounded-none overflow-hidden transition-all duration-300 flex flex-col pointer-events-auto"
        >
          <!-- Sticky Header -->
          <div class="sticky top-0 z-10 bg-surface-raised px-4 sm:px-8 py-4 sm:py-6 border-b border-border-muted/80 flex items-center gap-1 shrink-0">
            <button @click="handleBackClick" :disabled="tutorialReadonly" class="p-2 -ml-2 text-fg-subtle hover:text-fg transition-all cursor-pointer flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed">
              <ChevronLeft class="w-6 h-6" />
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 min-w-0">
                <h2 class="text-lg font-bold text-fg truncate leading-none min-w-0">{{ isEdit ? title : 'New Bucket' }}</h2>
                
                <!-- Streak Badge (Edit Mode Only) -->
                <div 
                  v-if="isEdit && (bucket?.currentStreak ?? 0) >= 2"
                  class="flex items-center gap-1 px-2 py-0.5 bg-surface-inset border rounded-full shrink-0"
                  :class="[
                    isStreakFaded(bucket!) ? 'opacity-30' : 'opacity-100',
                    getStreakTheme(bucket?.currentStreak ?? 0).border
                  ]"
                >
                  <span 
                    class="text-[9px] font-black tracking-tight"
                    :class="getStreakTheme(bucket?.currentStreak ?? 0).text"
                  >
                    x{{ bucket?.currentStreak }} STREAK
                  </span>
                  <Flame 
                    v-if="(bucket?.currentStreak ?? 0) >= 7"
                    class="w-2.5 h-2.5" 
                    :class="[
                      getStreakTheme(bucket?.currentStreak ?? 0).text,
                      getStreakTheme(bucket?.currentStreak ?? 0).fill
                    ]"
                  />
                </div>
              </div>
            </div>
            <button v-if="isEdit" @click="$emit('delete')" class="p-2 text-fg-subtle hover:text-rose-500 transition-all cursor-pointer flex-shrink-0">
              <Trash2 class="w-5 h-5" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
            <form id="bucketForm" @submit.prevent="handleSave" class="space-y-6">
              <div class="space-y-2" data-coach-target="buckets-add-name">
                <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Name</label>
                <input
                  v-model="title"
                  type="text"
                  placeholder="e.g. Morning Routine"
                  required
                  maxlength="50"
                  :disabled="tutorialReadonly"
                  class="w-full px-4 py-3 bg-surface-inset border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-border-strong text-fg placeholder-fg-subtle transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div class="space-y-2" data-coach-target="buckets-add-description">
                <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Description</label>
                <div class="relative">
                  <textarea
                    v-model="description"
                    rows="1"
                    maxlength="300"
                    placeholder=""
                    :disabled="tutorialReadonly"
                    @input="autoExpandTextarea"
                    class="w-full px-4 py-3 bg-surface-inset border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-border-strong text-fg placeholder-fg-subtle transition-all resize-none overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                  ></textarea>
                  <div class="absolute -bottom-5 right-1 text-[10px] font-bold text-fg-subtle">
                    {{ description.length }}/300
                  </div>
                </div>
              </div>

              <!-- Calendar (Edit Mode Only) -->
              <div v-if="isEdit" class="space-y-4">
                 <div class="flex items-center justify-between px-2">
                  <h3 class="text-sm font-bold uppercase tracking-widest text-fg">
                    {{ format(currentCalendarDate, 'MMMM yyyy') }}
                  </h3>
                  <div class="flex gap-2">
                    <button type="button" @click="prevMonth" class="p-2 hover:bg-surface-raised rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer">
                      <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button type="button" @click="nextMonth" class="p-2 hover:bg-surface-raised rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="bg-surface-inset rounded-2xl p-4 border border-surface-raised relative">
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition duration-300 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <div v-if="loading" class="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-fg"></div>
                    </div>
                  </Transition>
                  <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                    <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-fg-subtle mb-1">
                      {{ dayName }}
                    </div>
                    <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                      <div class="relative">
                        <div
                          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                          :class="[
                            (day.getMonth() !== currentCalendarDate.getMonth()) ? 'opacity-30' : '',
                            statusMap[format(day, 'yyyy-MM-dd')] === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                            statusMap[format(day, 'yyyy-MM-dd')] === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                            statusMap[format(day, 'yyyy-MM-dd')] === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                            statusMap[format(day, 'yyyy-MM-dd')] === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                            isMarkable(day) ? 'border-dashed border-cell-markable-border bg-transparent' : 'bg-cell-inactive-bg border-dashed border-cell-inactive-border'
                          ]"
                        >
                          <Check v-if="statusMap[format(day, 'yyyy-MM-dd')] === 'completed'" class="w-4 h-4 text-white" />
                          <XIcon v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'failed'" class="w-4 h-4 text-white" />
                          <Minus v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'skipped'" class="w-4 h-4 text-white" />
                          <Palmtree v-else-if="statusMap[format(day, 'yyyy-MM-dd')] === 'vacation'" class="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div class="text-[9px] font-bold" :class="isToday(day) ? 'text-fg' : 'text-fg-subtle'">
                        {{ format(day, 'd') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Habits Group -->
              <div class="space-y-2 pt-4" data-coach-target="buckets-add-habits">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold uppercase tracking-widest text-fg-subtle">Habits in this bucket</label>
                  <button 
                    type="button"
                    @click="toggleSelectAll"
                    :disabled="tutorialReadonly"
                    class="p-1 text-fg-subtle hover:text-fg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <CheckSquare class="w-4 h-4" />
                  </button>
                </div>

                <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <label v-for="habit in sortedHabits" :key="habit.id" class="flex items-center justify-between p-3 bg-surface-inset border border-surface-raised rounded-xl transition-colors" :class="tutorialReadonly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-border-muted'">
                    <span class="text-sm font-semibold text-fg truncate flex-1 min-w-0 mr-4">{{ habit.title }}</span>
                    <div 
                      class="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                      :class="[selectedHabitIds.includes(habit.id) ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-surface-raised']"
                    >
                      <Check v-if="selectedHabitIds.includes(habit.id)" class="w-3.5 h-3.5 text-white" />
                    </div>
                    <input type="checkbox" :value="habit.id" v-model="selectedHabitIds" :disabled="tutorialReadonly" class="hidden" />
                  </label>
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div class="px-8 py-4 border-t border-border-muted bg-surface-raised/80 backdrop-blur-md flex gap-3">
            <button @click="handleBackClick" :disabled="tutorialReadonly" class="flex-1 px-5 py-3 text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
            <button 
              type="submit"
              form="bucketForm" 
              :disabled="saving"
              :aria-disabled="tutorialReadonly || saving ? 'true' : undefined"
              data-coach-target="buckets-add-save"
              class="flex-1 px-5 py-3 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {{ isEdit ? 'Save' : 'Add Bucket' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChevronLeft, ChevronRight, Flame, Trash2, Check, X as XIcon, Minus, Palmtree, CheckSquare } from 'lucide-vue-next';
import { format, isToday } from 'date-fns';
import { getStreakTheme, isStreakFaded, autoExpandTextarea, isMarkable } from '~/utils/ui';
import { useCalendar } from '~/composables/useCalendar';
import type { Bucket, Habit } from '~/composables/useHabitsApi';

export type TutorialInitialValues = {
  title?: string;
  description?: string;
  habitIds?: string[];
};

const props = withDefaults(defineProps<{
  modelValue: boolean;
  bucket: Bucket | null;
  availableHabits: Habit[];
  statusMap: Record<string, string | undefined>;
  loading?: boolean;
  saving?: boolean;
  tutorialReadonly?: boolean;
  initialValues?: TutorialInitialValues;
}>(), {
  tutorialReadonly: false,
  initialValues: () => ({}),
});

const emit = defineEmits(['update:modelValue', 'save', 'delete', 'change-month']);

const isEdit = computed(() => !!props.bucket);
const title = ref('');
const description = ref('');
const selectedHabitIds = ref<string[]>([]);

const { 
  currentDate: currentCalendarDate, 
  days: calendarDays, 
  prevMonth: prevMonthRaw, 
  nextMonth: nextMonthRaw 
} = useCalendar();

const prevMonth = () => { prevMonthRaw(); emit('change-month', currentCalendarDate.value); };
const nextMonth = () => { nextMonthRaw(); emit('change-month', currentCalendarDate.value); };

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.tutorialReadonly && props.initialValues) {
      title.value = props.initialValues.title ?? '';
      description.value = props.initialValues.description ?? '';
      selectedHabitIds.value = [...(props.initialValues.habitIds ?? [])];
    } else {
      title.value = props.bucket?.title || '';
      description.value = props.bucket?.description || '';
      selectedHabitIds.value = [...(props.bucket?.habitIds || [])];
    }
    currentCalendarDate.value = new Date();
  }
}, { immediate: true });

const sortedHabits = computed(() => {
  const associated = new Set(props.bucket?.habitIds || []);
  return [...props.availableHabits].sort((a, b) => {
    const aIn = associated.has(a.id);
    const bIn = associated.has(b.id);
    if (aIn && !bIn) return -1;
    if (!aIn && bIn) return 1;
    return 0;
  });
});

const toggleSelectAll = () => {
  if (selectedHabitIds.value.length === props.availableHabits.length) {
    selectedHabitIds.value = [];
  } else {
    selectedHabitIds.value = props.availableHabits.map(h => h.id);
  }
};

const handleOverlayClick = () => {
  if (props.tutorialReadonly) return;
  emit('update:modelValue', false);
};

const handleBackClick = () => {
  if (props.tutorialReadonly) return;
  emit('update:modelValue', false);
};

const handleSave = () => {
  if (props.tutorialReadonly) return;
  emit('save', {
    title: title.value.trim(),
    description: description.value.trim(),
    habitIds: selectedHabitIds.value
  });
};
</script>
