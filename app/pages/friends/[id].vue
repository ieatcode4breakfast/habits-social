<template>
  <div class="space-y-8">
    <div class="flex flex-col md:flex-row md:items-center gap-6 mb-8" v-motion-slide-visible-once-left>
      <NuxtLink to="/social" class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-sm">
        <ArrowLeft class="w-6 h-6 text-slate-600 dark:text-slate-400" />
      </NuxtLink>
      
      <div v-if="profile" class="flex items-center gap-5">
        <div class="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
          <img v-if="profile.photourl" :src="profile.photourl" alt="photo" class="w-full h-full object-cover" />
          <User v-else class="w-8 h-8 text-slate-500 dark:text-slate-400" />
        </div>
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-1">{{ profile.displayname }}'s Habits</h1>
          <p class="text-slate-500 dark:text-slate-400 text-lg">Habits shared with you</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center p-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm tracking-tight">
      <table class="w-full text-left border-collapse min-w-max">
        <thead>
          <tr>
            <th class="p-5 border-b border-slate-200 dark:border-slate-800 w-full min-w-[200px]">
              <div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Shared Habits</div>
            </th>
            <th v-for="(day, i) in days" :key="i" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center min-w-[60px]">
              <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ format(day, "E") }}</div>
              <div class="mt-1 text-slate-900 dark:text-slate-100 font-semibold">{{ format(day, "d") }}</div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
          <tr v-if="habits.length === 0">
            <td colspan="8" class="p-8 text-center text-slate-500 dark:text-slate-400 italic">
              {{ profile?.displayname }} hasn't shared any habits with you yet.
            </td>
          </tr>
          <tr v-for="habit in habits" :key="habit.id" class="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="p-4">
              <div class="flex items-center gap-3 font-medium text-slate-900 dark:text-slate-100">
                <div class="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0" :style="{ backgroundColor: habit.color }" />
                {{ habit.title }}
              </div>
            </td>
            <td v-for="(day, i) in days" :key="i" class="p-2 text-center pointer-events-none">
              <div
                class="w-10 h-10 rounded-xl mx-auto flex items-center justify-center transition-all border-2 border-transparent relative overflow-hidden"
                :class="isCompleted(habit.id, day) ? 'shadow-sm' : 'bg-slate-100 dark:bg-slate-800'"
                :style="isCompleted(habit.id, day) ? { backgroundColor: '#10B981', borderColor: '#10B981' } : {}"
              >
                <!-- checkmark -->
                <svg v-if="isCompleted(habit.id, day)" class="w-5 h-5 text-white animate-in zoom-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
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

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const api = useHabitsApi()

const friendId = route.params.id as string

const habits = ref<Habit[]>([])
const logs = ref<HabitLog[]>([])
const profile = ref<any>(null)
const loading = ref(true)

const today = new Date()
const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i))

const loadData = async () => {
  if (!user.value || !friendId) return;
  loading.value = true;
  try {
    const { data: uSnap } = await supabase.from('users').select('*').eq('id', friendId);
    if (uSnap && uSnap.length > 0) {
      profile.value = uSnap[0];
    }

    const [h, l] = await Promise.all([
      api.getFriendHabits(friendId, user.value.id),
      api.getFriendHabitLogs(friendId, user.value.id)
    ]);
    habits.value = h;
    logs.value = l;
  } catch (e) {
    console.error("Failed to load friend's profile or habits", e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadData)

const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, "yyyy-MM-dd");
  return logs.value.some(l => l.habitid === habitId && l.date === dateStr && l.status === "completed");
}
</script>
