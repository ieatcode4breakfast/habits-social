<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between mb-8">
      <div v-motion-slide-visible-once-left>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
          Hello, {{ userName }} <span class="animate-bounce origin-bottom inline-block">👋</span>
        </h1>
        <p class="text-lg text-slate-500 dark:text-slate-400 font-normal">Track your daily progress</p>
      </div>
      <div v-motion-slide-visible-once-right>
        <button
          @click="openCreateModal"
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-medium shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 cursor-pointer"
        >
          <Plus class="w-5 h-5" />
          <span class="hidden md:inline">Add Habit</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center p-12 space-y-4">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="p-8 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-center space-y-4">
      <div class="text-red-500">{{ error }}</div>
      <button @click="loadData" class="px-4 py-2 bg-red-600 text-white rounded-lg">Retry</button>
    </div>

    <div v-else v-motion-fade class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
      <table class="w-full text-left border-collapse min-w-max">
        <thead>
          <tr>
            <th class="p-5 border-b border-slate-200 dark:border-slate-800 w-full min-w-[200px]">
              <div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">My Habits</div>
            </th>
            <th v-for="(day, i) in days" :key="i" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center min-w-[60px]">
              <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ format(day, 'E') }}</div>
              <div class="mt-1 text-slate-900 dark:text-slate-100 font-semibold">{{ format(day, 'd') }}</div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
          <tr v-if="habits.length === 0">
            <td colspan="8" class="p-8 text-center text-slate-500 dark:text-slate-400 italic">
              No habits yet. Click "Add Habit" to get started!
            </td>
          </tr>
          <tr v-for="habit in habits" :key="habit.id" class="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0" :style="{ backgroundColor: habit.color }" />
                <button @click="openEditModal(habit)" class="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer">
                  {{ habit.title }}
                  <Settings2 class="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </td>
            <td v-for="(day, i) in days" :key="i" class="p-2 text-center">
              <button
                @click="toggleDay(habit, day)"
                class="w-10 h-10 rounded-xl transition-all mx-auto flex items-center justify-center border-2 relative overflow-hidden"
                :class="isCompleted(habit.id, day) ? 'border-transparent text-white shadow-sm' : 'border-slate-200 dark:border-slate-700 text-transparent hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'"
                :style="isCompleted(habit.id, day) ? { backgroundColor: '#10B981', borderColor: '#10B981', color: 'white' } : {}"
              >
                <!-- the checkmark icon manually generated because Lucide Check needs to be defined -->
                <svg v-if="isCompleted(habit.id, day)" class="w-5 h-5 absolute inset-0 m-auto animate-in zoom-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <div v-else class="w-full h-full font-bold opacity-0 group-hover:opacity-50 text-slate-400 flex items-center justify-center">✓</div>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EditHabitModal
      :is-open="isModalOpen"
      :habit="editingHabit"
      @close="isModalOpen = false"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Settings2 } from 'lucide-vue-next';
import { format, subDays } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';

definePageMeta({ middleware: 'auth' })

const user = useSupabaseUser()
const api = useHabitsApi()

const habits = ref<Habit[]>([])
const logs = ref<HabitLog[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const isModalOpen = ref(false)
const editingHabit = ref<Partial<Habit>>({})

const userName = computed(() => {
  return user.value?.user_metadata?.full_name?.split(' ')[0] 
      || user.value?.email?.split('@')[0] 
      || 'Friend'
})

const today = new Date()
const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i))

const loadData = async () => {
  if (!user.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [h, l] = await Promise.all([
      api.getMyHabits(user.value.id),
      api.getHabitLogs(user.value.id)
    ])
    habits.value = h
    logs.value = l
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, "yyyy-MM-dd");
  return logs.value.some(l => l.habitid === habitId && l.date === dateStr && l.status === "completed");
}

const toggleDay = async (habit: Habit, day: Date) => {
  if (!user.value) return;
  const dateStr = format(day, "yyyy-MM-dd");
  const log = logs.value.find(l => l.habitid === habit.id && l.date === dateStr);
  
  if (log && log.status === "completed") {
    logs.value = logs.value.filter(l => l.id !== log.id);
  } else {
    const tempLog: HabitLog = { 
      id: "temp_" + Date.now(), 
      habitid: habit.id, 
      ownerid: user.value.id, 
      date: dateStr, 
      status: "completed", 
      sharedwith: habit.sharedwith 
    };
    logs.value = [...logs.value, tempLog];
  }

  try {
    await api.toggleHabitLog(user.value.id, habit, dateStr, log?.status);
    await loadData();
  } catch (e) {
    console.error(e)
    await loadData();
  }
}

const openCreateModal = () => {
  editingHabit.value = {
    title: "New Habit",
    color: "#818cf8",
    sharedwith: []
  }
  isModalOpen.value = true
}

const openEditModal = (habit: Habit) => {
  editingHabit.value = { ...habit }
  isModalOpen.value = true
}

const handleSave = async (habitData: Partial<Habit>) => {
  if (!user.value) return;
  isModalOpen.value = false;
  loading.value = true;
  try {
    if (habitData.id) {
      await api.updateHabit(habitData.id, habitData)
    } else {
      await api.createHabit(user.value.id, habitData)
    }
  } catch (e) {
    console.error(e)
  } finally {
    await loadData()
  }
}

const handleDelete = async (id: string) => {
  isModalOpen.value = false;
  loading.value = true;
  try {
    await api.deleteHabit(id)
  } catch (e) {
    console.error(e)
  } finally {
    await loadData()
  }
}
</script>
