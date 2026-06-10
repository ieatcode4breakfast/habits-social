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
      <div v-if="modelValue && habit" 
        class="fixed inset-0 z-[100] flex flex-col items-center justify-start overflow-y-auto sm:py-8 py-0"
      >
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md touch-none" @click="close"></div>
        <div class="relative my-auto w-full h-full sm:h-auto sm:max-w-md max-w-none bg-surface-raised border-x-0 sm:border border-border-muted sm:rounded-3xl rounded-none shadow-2xl overflow-hidden transition-all duration-300 flex flex-col">
          <div v-if="loading && (!logs || !logs.length)" class="flex justify-center p-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
          </div>
          <template v-else>
            <!-- Sticky Header -->
            <div class="sticky top-0 z-10 bg-surface-raised px-4 sm:px-8 py-4 sm:py-6 border-b border-border-muted/80 flex items-center gap-1 shrink-0">
              <button @click="close" class="p-2 -ml-2 text-fg-subtle hover:text-fg transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <h2 class="text-lg font-bold text-fg truncate leading-none min-w-0">{{ habit.title }}</h2>
                  <!-- Streak Badge -->
                  <div 
                    v-if="(habit.currentStreak ?? 0) >= 2"
                    class="flex items-center gap-1 px-2 py-0.5 bg-surface-inset border rounded-full shrink-0"
                    :class="[
                      isFaded(habit) ? 'opacity-30' : 'opacity-100',
                      getStreakTheme(habit.currentStreak ?? 0).border
                    ]"
                  >
                    <span 
                      class="text-[9px] font-black tracking-tight"
                      :class="getStreakTheme(habit.currentStreak ?? 0).text"
                    >
                      x{{ habit.currentStreak }} STREAK
                    </span>
                    <Flame 
                      v-if="(habit.currentStreak ?? 0) >= 7"
                      class="w-2.5 h-2.5" 
                      :class="[
                        getStreakTheme(habit.currentStreak ?? 0).text,
                        getStreakTheme(habit.currentStreak ?? 0).fill
                      ]"
                    />
                  </div>
                </div>
                <div class="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">
                  {{ getSkipSettingsText(habit) }}
                </div>
              </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-8 sm:py-6">
              <p v-if="habit.description" class="text-fg-muted text-sm mb-6 italic break-words whitespace-pre-wrap">
                {{ habit.description }}
              </p>

              <!-- Monthly Calendar View -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-2">
                  <h3 class="text-sm font-bold uppercase tracking-widest text-fg">
                    {{ format(currentCalendarDate, 'MMMM yyyy') }}
                  </h3>
                  <div class="flex gap-2">
                    <button type="button" @click="prevMonth" class="p-2 hover:bg-surface-hover rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer">
                      <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button type="button" @click="nextMonth" class="p-2 hover:bg-surface-hover rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="bg-surface-inset rounded-2xl p-4 border border-border-muted relative overflow-hidden">
                  <!-- Loading Overlay -->
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition duration-300 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <div v-if="loading" class="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-fg"></div>
                    </div>
                  </Transition>
                  <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                    <!-- Day Headers -->
                    <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-fg-subtle mb-1">
                      {{ dayName }}
                    </div>

                    <!-- Calendar Grid -->
                    <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                      <div
                        class="w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 relative"
                        :class="[
                          (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30 border-transparent' : '',
                          getStatus(day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                          getStatus(day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                          getStatus(day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                          getStatus(day) === 'vacation' ? 'bg-amber-500 border-amber-500 shadow-md shadow-amber-500/20' :
                          'border-dashed border-cell-markable-border bg-transparent'
                        ]"
                      >
                        <Check v-if="getStatus(day) === 'completed'" class="w-3 h-3 text-fg" />
                        <XIcon v-else-if="getStatus(day) === 'failed'" class="w-3 h-3 text-fg" />
                        <span v-else-if="getStatus(day) === 'skipped'" class="w-3 h-0.5 bg-action-primary rounded-full"></span>
                        <Palmtree v-else-if="getStatus(day) === 'vacation'" class="w-3 h-3 text-fg" />
                      </div>
                      <div class="text-[9px] font-bold" :class="[
                        day.getMonth() === currentCalendarDate.getMonth() ? 'text-fg' : 'text-fg-subtle',
                        day.getMonth() !== currentCalendarDate.getMonth() ? 'opacity-30' : ''
                      ]">
                        {{ format(day, 'd') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useModalHistory } from '~/composables/useModalHistory';
import { ChevronLeft, ChevronRight, Check, X as XIcon, Flame, Palmtree } from 'lucide-vue-next';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays, isAfter, startOfDay, subMonths, addMonths } from 'date-fns';

const props = defineProps<{
  modelValue: boolean;
  habit: any;
  logs: any[];
  loading: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'month-changed']);

const currentCalendarDate = ref(new Date());

const close = () => {
  emit('update:modelValue', false);
};

useModalHistory(computed(() => props.modelValue), close);

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    currentCalendarDate.value = new Date();
  }
});

const calendarDays = computed(() => {
  const start = startOfMonth(currentCalendarDate.value);
  const end = endOfMonth(currentCalendarDate.value);
  const daysInMonth = eachDayOfInterval({ start, end });
  const firstDay = start.getDay();
  const paddingStart = Array.from({ length: firstDay }, (_, i) => subDays(start, firstDay - i));
  const lastDay = end.getDay();
  const paddingEnd = Array.from({ length: 6 - lastDay }, (_, i) => addDays(end, i + 1));
  return [...paddingStart, ...daysInMonth, ...paddingEnd];
});

const prevMonth = () => {
  currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
  emit('month-changed', currentCalendarDate.value);
};

const nextMonth = () => {
  currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);
  emit('month-changed', currentCalendarDate.value);
};

const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(new Date()));

const getStatus = (day: Date) => {
  if (!props.habit) return undefined;
  const dateStr = format(day, 'yyyy-MM-dd');
  return props.logs?.find((l: any) => l.habitId === props.habit.id && l.date === dateStr)?.status;
};

const getSkipSettingsText = (habit: { skipsPeriod?: string | null; skipsCount?: number | null }) => {
  const period = habit.skipsPeriod;
  const count = habit.skipsCount ?? 0;
  if (period === 'disabled' || ((period === 'weekly' || period === 'monthly') && count === 0)) {
    return 'No skips allowed';
  }
  if (period === 'none') return 'Unlimited skips';
  const skipText = count === 1 ? '1 skip' : `${count} skips`;
  return `${period}, ${skipText} allowed`;
};

import { isStreakFaded, getStreakTheme } from '~/utils/ui';
const isFaded = (habit: any) => isStreakFaded(habit);
</script>
