<template>
  <div class="space-y-3">
    <div class="flex flex-col md:flex-row md:items-center gap-4 px-4 sm:px-0" v-motion-slide-visible-once-left>
      <NuxtLink to="/social" class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 hover:bg-zinc-800 transition-all shadow-xl flex-shrink-0">
        <ArrowLeft class="w-5 h-5 text-zinc-400 hover:text-white transition-colors" />
      </NuxtLink>
      <div v-if="profile" class="flex items-center gap-4">
        <div class="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
          <img v-if="profile.photourl" :src="profile.photourl" alt="" class="w-full h-full object-cover" />
          <User v-else class="w-7 h-7 text-zinc-600" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">{{ profile.displayname }}'s Habits</h1>
          <p class="text-zinc-400 text-sm">Habits shared with you</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center p-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>

    <!-- Shared Habit List (Single Card) -->
    <div v-if="!loading" v-motion-fade class="bg-zinc-900/80 backdrop-blur-sm sm:rounded-2xl rounded-none shadow-2xl divide-y divide-zinc-800/80 border border-zinc-800/80">
      <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        {{ profile?.displayname }} hasn't shared any habits with you yet.
      </div>
      
      <div v-for="habit in habits" :key="habit.id" class="p-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <!-- Title Section -->
        <div class="flex items-start gap-3 min-w-[200px] flex-1">
          <h3 class="font-bold text-zinc-200 leading-tight break-words">{{ habit.title }}</h3>
        </div>
        
        <!-- Checkboxes Section -->
        <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-3">
          <div class="flex justify-evenly items-end w-full max-w-lg">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
            <div class="text-[10px] uppercase tracking-tighter text-zinc-500 font-black">
              {{ format(day, 'EEE') }}
            </div>
            
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all"
              :class="isCompleted(habit.id, day)
                ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/20'
                : 'border-dashed border-zinc-800 bg-transparent'"
            >
              <svg v-if="isCompleted(habit.id, day)" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div class="text-[10px] font-bold" :class="isCompleted(habit.id, day) ? 'text-white' : 'text-zinc-600'">
              {{ format(day, 'd') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ArrowLeft, User } from 'lucide-vue-next';
import { format, subDays } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const friendId = route.params.id as string;

const profile = ref<any>(null);
const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const loading = ref(true);

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));

const load = async () => {
  loading.value = true;
  try {
    const [p, data] = await Promise.all([
      $fetch<any>('/api/social/profile', { query: { friendId } }),
      $fetch<{ habits: Habit[]; logs: HabitLog[] }>('/api/social/friend-data', { query: { friendId } })
    ]);
    profile.value = p;
    habits.value = data.habits;
    logs.value = data.logs;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.some(l => l.habitid === habitId && l.date === dateStr && l.status === 'completed');
};
</script>
