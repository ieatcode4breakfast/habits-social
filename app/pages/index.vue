<template>
  <div class="space-y-3">
    <!-- Header -->
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">My Habits</h1>
        <p class="text-slate-500 dark:text-slate-400">Track your habits this week</p>
      </div>
      <button @click="showModal = true" class="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer text-sm flex items-center gap-2 active:scale-95">
        <Plus class="w-4 h-4" /> Add
      </button>
    </div>

    <!-- Habit List (Single Card) -->
    <div v-motion-fade class="bg-slate-900/40 backdrop-blur-sm sm:rounded-2xl rounded-none shadow-xl divide-y divide-slate-800/50">
      <div v-if="habits.length === 0" class="p-10 text-center text-slate-400 dark:text-slate-500 italic text-sm">
        No habits yet. Add one above!
      </div>
      
      <div v-for="habit in habits" :key="habit.id" class="relative p-4 group transition-all flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <!-- Title Section -->
        <div class="flex items-start gap-3 min-w-[200px] flex-1">
          <h3 class="font-bold text-slate-900 dark:text-slate-100 leading-tight break-words">{{ habit.title }}</h3>
        </div>
        
        <!-- Checkboxes & Actions Section -->
        <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-4">
          <div class="flex justify-evenly items-end w-full max-w-lg">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
              <div class="text-[10px] uppercase tracking-tighter text-slate-500 dark:text-slate-400 font-black">
                {{ format(day, 'EEE') }}
              </div>
              
              <button
                @click="toggleLog(habit, day)"
                class="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
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

        <!-- Delete Action (Absolute) -->
        <button @click="removeHabit(habit.id)" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all cursor-pointer">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>


    <!-- Add Habit Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 overflow-hidden">
            <h2 class="text-2xl font-bold text-white mb-6">New Habit</h2>
            
            <form @submit.prevent="addHabit" class="space-y-6">
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-slate-500">Habit Name</label>
                <input
                  v-model="newTitle"
                  type="text"
                  placeholder="e.g. Morning Meditation"
                  required
                  maxlength="50"
                  autofocus
                  class="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-600 transition-all"
                />
              </div>

              <div class="flex gap-3 pt-4">
                <button
                  type="button"
                  @click="showModal = false"
                  class="flex-1 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  Add Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
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
const showModal = ref(false);

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
  const habit = await api.createHabit({ title: newTitle.value.trim(), color: '#6366f1' });
  habits.value.push(habit);
  newTitle.value = '';
  showModal.value = false;
};

const removeHabit = async (id: string) => {
  await api.deleteHabit(id);
  habits.value = habits.value.filter(h => h.id !== id);
};
</script>
