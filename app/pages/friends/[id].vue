<template>
  <div class="space-y-8">
    <div class="flex flex-col md:flex-row md:items-center gap-4" v-motion-slide-visible-once-left>
      <NuxtLink to="/social" class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex-shrink-0">
        <ArrowLeft class="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </NuxtLink>
      <div v-if="profile" class="flex items-center gap-4">
        <div class="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
          <img v-if="profile.photourl" :src="profile.photourl" alt="" class="w-full h-full object-cover" />
          <User v-else class="w-7 h-7 text-slate-400" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{{ profile.displayname }}'s Habits</h1>
          <p class="text-slate-500 dark:text-slate-400 text-sm">Habits shared with you</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center p-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
      <table class="w-full text-left border-collapse min-w-max">
        <thead>
          <tr>
            <th class="p-5 border-b border-slate-200 dark:border-slate-800 w-full min-w-[200px]">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Shared Habits</span>
            </th>
            <th v-for="(day, i) in days" :key="i" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center min-w-[52px]">
              <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ format(day, 'E') }}</div>
              <div class="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ format(day, 'd') }}</div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
          <tr v-if="habits.length === 0">
            <td colspan="8" class="p-10 text-center text-slate-400 dark:text-slate-500 italic text-sm">
              {{ profile?.displayname }} hasn't shared any habits with you yet.
            </td>
          </tr>
          <tr v-for="habit in habits" :key="habit.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="p-4">
              <div class="flex items-center gap-3 font-medium text-slate-900 dark:text-slate-100">
                <div class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: habit.color }" />
                {{ habit.title }}
              </div>
            </td>
            <td v-for="(day, i) in days" :key="i" class="p-2 text-center">
              <div
                class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center border-2 transition-all"
                :class="isCompleted(habit.id, day)
                  ? 'border-emerald-500 bg-emerald-500 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'"
              >
                <svg v-if="isCompleted(habit.id, day)" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
