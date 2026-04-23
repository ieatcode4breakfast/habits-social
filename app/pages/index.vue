<template>
  <div class="space-y-3">
    <!-- Header -->
    <div v-motion-slide-visible-once-left class="px-4 sm:px-0 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-white mb-1">My Habits</h1>
        <p class="text-zinc-400">Track your habits this week</p>
      </div>
      <button @click="showModal = true" class="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center gap-2 active:scale-95">
        <Plus class="w-4 h-4" /> Add
      </button>
    </div>

    <!-- Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-900/80 backdrop-blur-md sm:rounded-2xl rounded-none shadow-2xl border border-zinc-800/80 divide-y divide-zinc-800/80">
      <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        No habits yet. Add one above!
      </div>
      
      <div v-for="habit in habits" :key="habit.id" class="relative p-4 group transition-all flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <!-- Title Section -->
        <div class="flex items-start gap-3 min-w-[200px] flex-1">
          <button 
            @click="openEditModal(habit)"
            class="text-left group/title flex items-start gap-2 cursor-pointer relative"
          >
            <h3 class="font-bold text-zinc-200 leading-tight break-words group-hover/title:text-white transition-colors">{{ habit.title }}</h3>
            
            <!-- Tooltip -->
            <div class="absolute -top-8 left-0 px-2 py-1 bg-black backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover/title:opacity-100 transition-all translate-y-1 group-hover/title:translate-y-0 pointer-events-none whitespace-nowrap border border-zinc-800 shadow-2xl z-10">
              Edit habit
            </div>
          </button>
        </div>
        
        <!-- Checkboxes & Actions Section -->
        <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-4">
          <div class="flex justify-evenly items-end w-full max-w-lg">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
              <div class="text-[10px] uppercase tracking-tighter text-zinc-500 font-black">
                {{ format(day, 'EEE') }}
              </div>
              
              <button
                @click="toggleLog(habit, day)"
                class="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative"
                :class="[
                  getStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                  getStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                  getStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                  'bg-transparent hover:bg-zinc-900 border-dashed border-zinc-800'
                ]"
              >
                <Check v-if="getStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                <X v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
              </button>

              <div class="text-[10px] font-bold" :class="isToday(day) ? 'text-white' : 'text-zinc-500'">
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>

        </div>

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
        <div v-if="showModal" class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-900 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto">
            <h2 class="text-2xl font-bold text-white mb-6">New Habit</h2>
            
            <form @submit.prevent="addHabit" class="space-y-6">
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habit Name</label>
                <input
                  v-model="newTitle"
                  type="text"
                  placeholder="e.g. Morning Meditation"
                  required
                  maxlength="50"
                  autofocus
                  class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all"
                />
              </div>

              <div class="flex gap-3 pt-4">
                <button
                  type="button"
                  @click="showModal = false"
                  class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
                >
                  Add Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Habit Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showEditModal" class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showEditModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full h-full sm:h-auto sm:max-w-lg max-w-none bg-zinc-900 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-white">Edit Habit</h2>
              <button @click="showDeleteModal = true" class="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer">
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
            
            <form @submit.prevent="updateHabit" class="space-y-6">
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-widest text-zinc-500">Habit Name</label>
                <input
                  v-model="editTitle"
                  type="text"
                  required
                  maxlength="50"
                  class="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 text-white placeholder-zinc-700 transition-all"
                />
              </div>

              <!-- Monthly Calendar View -->
              <div class="space-y-4">
                <div class="flex items-center justify-between px-2">
                  <h3 class="text-sm font-bold uppercase tracking-widest text-white">
                    {{ format(currentCalendarDate, 'MMMM yyyy') }}
                  </h3>
                  <div class="flex gap-2">
                    <button type="button" @click="prevMonth" class="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronLeft class="w-4 h-4" />
                    </button>
                    <button type="button" @click="nextMonth" class="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                      <ChevronRight class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="bg-black rounded-2xl p-4 border border-zinc-900">
                  <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                    <!-- Day Headers -->
                    <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-zinc-600 mb-1">
                      {{ dayName }}
                    </div>

                    <!-- Calendar Grid -->
                    <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        @click="day.getMonth() === currentCalendarDate.getMonth() && !isFutureDay(day) && toggleLog(editingHabit!, day)"
                        :disabled="day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)"
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                        :class="[
                          (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30 cursor-not-allowed border-transparent' : 'cursor-pointer',
                          getStatus(editingHabit!.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                          getStatus(editingHabit!.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                          getStatus(editingHabit!.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                          'border-dashed border-zinc-800 bg-transparent hover:bg-zinc-900'
                        ]"
                      >
                        <Check v-if="getStatus(editingHabit!.id, day) === 'completed'" class="w-3 h-3 text-white" />
                        <X v-else-if="getStatus(editingHabit!.id, day) === 'failed'" class="w-3 h-3 text-white" />
                        <span v-else-if="getStatus(editingHabit!.id, day) === 'skipped'" class="w-3 h-0.5 bg-white rounded-full"></span>
                      </button>
                      <div class="text-[9px] font-bold" :class="[
                        isToday(day) ? 'text-white' : 'text-zinc-600',
                        (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30' : ''
                      ]">
                        {{ format(day, 'd') }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex gap-3 pt-4">
                <button
                  type="button"
                  @click="showEditModal = false"
                  class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showDeleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showDeleteModal = false"></div>
          
          <!-- Modal Content -->
          <div class="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 class="w-8 h-8 text-zinc-400" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Delete Habit?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              This will permanently remove "<span class="text-zinc-200 font-medium">{{ editingHabit?.title }}</span>" and all its progress. This action cannot be undone.
            </p>
            
            <div class="flex flex-col gap-3">
              <button
                @click="handleDelete"
                class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer"
              >
                Delete Permanently
              </button>
              <button
                @click="showDeleteModal = false"
                class="w-full px-5 py-3 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
              >
                Keep Habit
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X, Minus, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();

const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const newTitle = ref('');
const showModal = ref(false);

const showEditModal = ref(false);
const showDeleteModal = ref(false);
const editingHabit = ref<Habit | null>(null);
const editTitle = ref('');
const currentCalendarDate = ref(new Date());

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

const today = new Date();
const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(today));
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const startDate = format(days[0]!, 'yyyy-MM-dd');
const endDate = format(today, 'yyyy-MM-dd');

const load = async () => {
  [habits.value, logs.value] = await Promise.all([api.getHabits(), api.getLogs(startDate, endDate)]);
};

onMounted(load);

const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitid === habitId && l.date === dateStr)?.status;
};

const toggleLog = async (habit: Habit, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const currentStatus = getStatus(habit.id, day);

  let nextStatus: 'completed' | 'failed' | 'skipped' | null = null;
  if (!currentStatus) nextStatus = 'completed';
  else if (currentStatus === 'completed') nextStatus = 'failed';
  else if (currentStatus === 'failed') nextStatus = 'skipped';
  else if (currentStatus === 'skipped') nextStatus = null;

  if (nextStatus) {
    const log = await api.upsertLog({ habitid: habit.id, date: dateStr, status: nextStatus });
    const idx = logs.value.findIndex(l => l.habitid === habit.id && l.date === dateStr);
    if (idx >= 0) logs.value[idx] = log;
    else logs.value.push(log);
  } else {
    await api.deleteLog(habit.id, dateStr);
    logs.value = logs.value.filter(l => !(l.habitid === habit.id && l.date === dateStr));
  }
};

const addHabit = async () => {
  if (!newTitle.value.trim()) return;
  const habit = await api.createHabit({ title: newTitle.value.trim(), color: '#6366f1' });
  habits.value.push(habit);
  newTitle.value = '';
  showModal.value = false;
};

const openEditModal = (habit: Habit) => {
  editingHabit.value = habit;
  editTitle.value = habit.title;
  currentCalendarDate.value = new Date();
  showEditModal.value = true;
};

const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);

const updateHabit = async () => {
  if (!editingHabit.value || !editTitle.value.trim()) return;
  const updated = await api.updateHabit(editingHabit.value.id, { title: editTitle.value.trim() });
  const idx = habits.value.findIndex(h => h.id === editingHabit.value?.id);
  if (idx >= 0) habits.value[idx] = updated;
  showEditModal.value = false;
};

const handleDelete = async () => {
  if (!editingHabit.value) return;
  await api.deleteHabit(editingHabit.value.id);
  habits.value = habits.value.filter(h => h.id !== editingHabit.value?.id);
  showDeleteModal.value = false;
  showEditModal.value = false;
};

const removeHabit = async (id: string) => {
  await api.deleteHabit(id);
  habits.value = habits.value.filter(h => h.id !== id);
};
</script>
