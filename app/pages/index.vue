<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Dashboard</h1>
      <p class="text-slate-500 dark:text-slate-400">Track your habits this week</p>
    </div>

    <!-- Add Habit -->
    <div v-motion-fade class="bg-slate-900/40 backdrop-blur-sm border-y sm:border border-slate-800/50 sm:rounded-2xl rounded-none p-6 shadow-xl">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">New Habit</h2>
      <form @submit.prevent="addHabit" class="flex gap-3 flex-wrap">
        <input
          v-model="newTitle"
          type="text"
          placeholder="Habit name..."
          required
          maxlength="50"
          class="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm transition-all"
        />
        <input v-model="newColor" type="color" class="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-800" />
        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-500/20 cursor-pointer text-sm flex items-center gap-2">
          <Plus class="w-4 h-4" /> Add
        </button>
      </form>
    </div>

    <!-- Habit List -->
    <div v-motion-fade class="space-y-3">
      <div v-if="habits.length === 0" class="p-10 text-center text-slate-400 dark:text-slate-500 italic text-sm bg-slate-900/40 backdrop-blur-sm border-y sm:border border-slate-800/50 sm:rounded-2xl">
        No habits yet. Add one above!
      </div>
      
      <div v-for="habit in habits" :key="habit.id" class="bg-slate-900/40 backdrop-blur-sm border-y sm:border border-slate-800/50 sm:rounded-2xl p-4 shadow-xl group transition-all hover:border-slate-700/50">
        <!-- Top Row: Title & Action -->
        <div class="flex items-start justify-between gap-4 mb-5">
          <div class="flex items-start gap-3">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm mt-1.5" :style="{ backgroundColor: habit.color }" />
            <h3 class="font-bold text-slate-900 dark:text-slate-100 leading-tight break-words max-w-sm sm:max-w-md">{{ habit.title }}</h3>
          </div>
          <button @click="removeHabit(habit.id)" class="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all cursor-pointer">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        
        <!-- Bottom Row: Days Grid -->
        <div class="flex justify-between items-end gap-1">
          <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
            <div class="text-[10px] uppercase tracking-tighter text-slate-500 dark:text-slate-400 font-black">
              {{ format(day, 'EEE') }}
            </div>
            
            <button
              @click="toggleLog(habit, day)"
              class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
              :class="isCompleted(habit.id, day)
                ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/30'
                : 'border-slate-200 dark:border-slate-700 bg-slate-950/30 dark:bg-slate-800/50 hover:border-indigo-500/50'"
            >
              <svg v-if="isCompleted(habit.id, day)" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              
              <!-- Today Indicator -->
              <div v-if="isToday(day)" class="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full border border-slate-900" />
            </button>

            <div class="text-[10px] font-bold" :class="isToday(day) ? 'text-indigo-400' : 'text-slate-500'">
              {{ format(day, 'd') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next';
import { format, subDays, isToday } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();

const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const newTitle = ref('');
const newColor = ref('#6366f1');

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const startDate = format(days[0]!, 'yyyy-MM-dd');
const endDate = format(today, 'yyyy-MM-dd');

const load = async () => {
  [habits.value, logs.value] = await Promise.all([api.getHabits(), api.getLogs(startDate, endDate)]);
};

onMounted(load);

const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.some(l => l.habitid === habitId && l.date === dateStr && l.status === 'completed');
};

const toggleLog = async (habit: Habit, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const completed = isCompleted(habit.id, day);
  const log = await api.upsertLog({ habitid: habit.id, date: dateStr, status: completed ? 'skipped' : 'completed' });
  const idx = logs.value.findIndex(l => l.habitid === habit.id && l.date === dateStr);
  if (idx >= 0) logs.value[idx] = log;
  else logs.value.push(log);
};

const addHabit = async () => {
  if (!newTitle.value.trim()) return;
  const habit = await api.createHabit({ title: newTitle.value.trim(), color: newColor.value });
  habits.value.push(habit);
  newTitle.value = '';
  newColor.value = '#6366f1';
};

const removeHabit = async (id: string) => {
  await api.deleteHabit(id);
  habits.value = habits.value.filter(h => h.id !== id);
};
</script>
