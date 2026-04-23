<template>
  <div class="space-y-8">
    <!-- Header -->
    <div v-motion-slide-visible-once-left>
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">Dashboard</h1>
      <p class="text-slate-500 dark:text-slate-400">Track your habits this week</p>
    </div>

    <!-- Add Habit -->
    <div v-motion-fade class="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 shadow-xl">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">New Habit</h2>
      <form @submit.prevent="addHabit" class="flex gap-3 flex-wrap">
        <input
          v-model="newTitle"
          type="text"
          placeholder="Habit name..."
          required
          class="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500 text-sm transition-all"
        />
        <input v-model="newColor" type="color" class="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-800" />
        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-500/20 cursor-pointer text-sm flex items-center gap-2">
          <Plus class="w-4 h-4" /> Add
        </button>
      </form>
    </div>

    <!-- Habit Grid -->
    <div v-motion-fade class="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl overflow-x-auto shadow-xl">
      <table class="w-full text-left border-collapse min-w-max">
        <thead>
          <tr>
            <th class="p-5 border-b border-slate-200 dark:border-slate-800 w-full min-w-[200px]">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Habit</span>
            </th>
            <th v-for="(day, i) in days" :key="i" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center min-w-[52px]">
              <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ format(day, 'E') }}</div>
              <div class="mt-0.5 text-sm font-semibold" :class="isToday(day) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'">
                {{ format(day, 'd') }}
              </div>
            </th>
            <th class="p-4 border-b border-slate-200 dark:border-slate-800 min-w-[60px]"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
          <tr v-if="habits.length === 0">
            <td colspan="9" class="p-10 text-center text-slate-400 dark:text-slate-500 italic text-sm">No habits yet. Add one above!</td>
          </tr>
          <tr v-for="habit in habits" :key="habit.id" class="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="p-4">
              <div class="flex items-center gap-3 font-medium text-slate-900 dark:text-slate-100">
                <div class="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" :style="{ backgroundColor: habit.color }" />
                {{ habit.title }}
              </div>
            </td>
            <td v-for="(day, i) in days" :key="i" class="p-2 text-center">
              <button
                @click="toggleLog(habit, day)"
                class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center transition-all border-2 cursor-pointer"
                :class="isCompleted(habit.id, day)
                  ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:border-indigo-400'"
              >
                <svg v-if="isCompleted(habit.id, day)" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </td>
            <td class="p-2 text-center">
              <button @click="removeHabit(habit.id)" class="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all cursor-pointer">
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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
