<template>
  <div class="relative">
    <!-- Sticky Header + Date Row -->
    <div class="sticky top-0 md:top-[57px] z-40">
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-4">
        <UserAvatar 
          v-if="user"
          :src="user.photoUrl" 
          container-class="w-10 h-10 bg-zinc-925 rounded-xl shadow-sm"
          icon-class="w-6 h-6 text-zinc-600"
        />
        <div>
          <h1 class="text-base font-bold tracking-tight text-white mb-1">My habits</h1>
          <p class="text-zinc-400 text-xs">{{ habits.length }} habit{{ habits.length === 1 ? '' : 's' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="habits.length > 1"
          @click="showReorderModal = true"
          class="w-11 sm:w-28 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95 border border-zinc-700/60"
          title="Reorder"
        >
          <ArrowUpDown class="w-4 h-4" />
          <span class="hidden sm:inline">Reorder</span>
        </button>
        <button 
          @click="openAddModal" 
          class="w-11 sm:w-28 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          title="Add Habit"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
    <!-- Date Header -->
    <div class="bg-zinc-925 border-b border-t border-x-0 sm:border-x border-zinc-800/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block pr-0 sm:pr-2"></div>
        <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
          <div class="flex justify-evenly sm:justify-between items-end w-full">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center w-8">
              <div 
                class="text-[10px] uppercase tracking-tighter font-black transition-colors"
                :class="isToday(day) ? 'text-white' : 'text-zinc-500'"
              >
                {{ format(day, 'EEE') }}
              </div>
              <div 
                class="text-[10px] sm:text-xs font-bold transition-colors"
                :class="isToday(day) ? 'text-white' : 'text-zinc-500'"
              >
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>
        </div>
    </div>
    </div>

    <!-- Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-b-2xl rounded-none shadow-2xl border-b border-x-0 sm:border-x sm:border-b border-zinc-800/80 divide-y divide-zinc-800/80 relative">

      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
          No habits yet. Add one above!
        </div>
      
      <div 
        v-for="habit in habits" :key="habit.id"
        :data-habit-id="habit.id"
        draggable="true"
        @dragstart="onDragStart($event, habit.id)"
        @dragover.prevent="onDragOver($event, habit.id)"
        @drop.prevent="onDrop($event, habit.id)"
        @dragend="onDragEnd"
        @click="openEditModal(habit)"
        class="relative py-3 group transition-all flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-zinc-800/40 sm:px-4"
        :class="[
          draggingId === habit.id ? 'opacity-30' : 'opacity-100',
          dragOverId === habit.id ? 'ring-2 ring-inset ring-white/20 bg-zinc-800/50' : ''
        ]"
      >
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-1 pr-0 sm:pr-2">
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <h3 class="text-sm font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ habit.title }}</h3>
            <!-- Compact Streak Badge -->
            <div 
              v-if="(habit.currentStreak ?? 0) >= 2"
              class="flex items-center gap-1 px-1.5 py-0.5 bg-black border rounded-md shrink-0"
              :class="[
                isFaded(habit) ? 'opacity-30' : 'opacity-100',
                getStreakTheme(habit.currentStreak ?? 0).border
              ]"
            >
              <Flame 
                v-if="(habit.currentStreak ?? 0) >= 7"
                class="w-2.5 h-2.5" 
                :class="[
                  getStreakTheme(habit.currentStreak ?? 0).text,
                  getStreakTheme(habit.currentStreak ?? 0).fill
                ]"
              />
              <span 
                class="text-[10px] font-black tracking-tight"
                :class="getStreakTheme(habit.currentStreak ?? 0).text"
              >
                x{{ habit.currentStreak }}
              </span>
            </div>
          </div>
          <!-- Frequency Text -->
          <div class="text-[10px] font-semibold tracking-tight text-zinc-500">
            {{ getFrequencyText(habit) }}
          </div>
        </div>
        
        <!-- Interactive Logs -->
        <TimelineRow
          interactive
          :days="days"
          :status-map="getHabitStatusMap(habit.id)"
          @click-day="(day, event) => openLogMenu(habit, day, event)"
        />

      </div>
      </template>
    </div>


    <!-- Add Habit Modal -->
    <HabitAddModal
      v-model="showModal"
      :friends="friends"
      :saving="isAddingHabit"
      @save="handleHabitAdd"
    />

    <!-- Shared Habit Edit Modal -->
    <HabitEditModal
      v-model="showEditModal"
      :habit="editingHabit"
      :friends="friends"
      :logs="logs"
      @habit-updated="onHabitUpdatedFromModal"
      @habit-deleted="onHabitDeletedFromModal"
      @open-log-menu="openLogMenu"
    />

    <!-- Reorder Modal -->
    <ReorderModal
      v-model="showReorderModal"
      title="Reorder habits"
      :items="habits"
      @reorder="onHabitsReordered"
    />

    <!-- Global Log Menu -->
    <LogMenu
      :habit="activeHabitForMenu || null"
      :date="activeLogMenu?.date || null"
      :logs="logs"
      :reference-el="referenceRef"
      :skips-period="showEditModal && editingHabit?.id === activeLogMenu?.habitId ? editSkipsPeriod : undefined"
      :skips-count="showEditModal && editingHabit?.id === activeLogMenu?.habitId ? editSkipsCount : undefined"
      @select="setLogStatus"
      @close="closeLogMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, GripVertical, ArrowUpDown, Flame, Palmtree } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, parseISO, startOfWeek, isBefore, isSameDay } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';
import { getStreakTheme, isStreakFaded as isFaded, autoExpandTextarea as autoExpand } from '~/utils/ui';
import { useSortableList } from '~/composables/useSortableList';
import { useCalendar } from '~/composables/useCalendar';

definePageMeta({ middleware: 'auth' });
import { useSocial } from '../composables/useSocial';

const api = useHabitsApi();
const { user } = useAuth();
const { lastSyncTime } = api;
const { friends: rawFriends, refresh: refreshSocial, init: initSocial, cleanup: cleanupSocial } = useSocial();

const friends = computed(() => {
  const list = [...(rawFriends.value || [])];
  return list.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
});

const sortedFriendsForEdit = computed(() => {
  if (!editingHabit.value) return friends.value;
  const sharedIds = new Set(editingHabit.value.sharedWith || []);
  return [...friends.value].sort((a, b) => {
    const aShared = sharedIds.has(a.id);
    const bShared = sharedIds.has(b.id);
    if (aShared && !bShared) return -1;
    if (!aShared && bShared) return 1;
    return 0; // friends is already sorted alphabetically
  });
});
const { showToast } = useToast();

const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const loading = ref(true);

const showModal = ref(false);
const showReorderModal = ref(false);
const showEditModal = ref(false);
const editingHabit = ref<Habit | null>(null);
const editSkipsPeriod = ref<'none' | 'weekly' | 'monthly' | undefined>(undefined);
const editSkipsCount = ref<number | undefined>(undefined);
const editSharedWith = ref<string[]>([]);
const editSharedWithWorking = ref<string[]>([]);
const isEditingSharing = ref(false);
const showSharingConfirmModal = ref(false);
const reachedConfirmViaDone = ref(false);
const editDescriptionRef = ref<HTMLTextAreaElement | null>(null);
const {
  currentDate: currentCalendarDate,
  days: calendarDays,
  prevMonth,
  nextMonth
} = useCalendar();

const calendarLoading = ref(false);
const isAddingHabit = ref(false);

const {
  draggingId,
  dragOverId,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onGripTouchStart: onGripTouchStartRaw
} = useSortableList(habits, (newOrderIds) => {
  api.reorderHabits(newOrderIds).catch(err => {
    console.error('[My Habits] Failed to save reorder:', err);
    showToast('Failed to save order', 'failed');
  });
});

const onHabitsReordered = (newOrderIds: string[]) => {
  api.reorderHabits(newOrderIds);
};

const onGripTouchStart = (e: TouchEvent, id: string) => {
  onGripTouchStartRaw(e, id, '[data-habit-id]');
};

const openAddModal = () => {
  if (habits.value.length >= 30) {
    showToast('Limit reached: You can track a maximum of 30 habits.', 'failed');
    return;
  }
  showModal.value = true;
};

// Logic moved to utils/ui

// Logic moved to useCalendar

const today = new Date();
const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(today));
const isMarkable = (day: Date) => {
  const d = startOfDay(day);
  const t = startOfDay(today);
  const limit = subDays(t, 13); // Last 14 days including today
  return !isBefore(d, limit) && !isAfter(d, t);
};
const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn: 0 }), i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

// Logic moved to utils/ui

const getFrequencyText = (habit: Habit) => {
  const period = habit.skipsPeriod;
  const maxSkips = habit.skipsCount ?? 0;
  const now = new Date();

  let skipped = 0;
  if (period === 'weekly') {
    skipped = logs.value.filter(l => 
      l.habitId === habit.id && 
      l.status === 'skipped' && 
      isSameWeek(new Date(l.date), now, { weekStartsOn: 0 })
    ).length;
  } else if (period === 'monthly') {
    skipped = logs.value.filter(l => 
      l.habitId === habit.id && 
      l.status === 'skipped' && 
      isSameMonth(new Date(l.date), now)
    ).length;
  }

  if (period === 'none') return 'Unlimited skips';

  const remainingSkips = Math.max(0, maxSkips - skipped);
  const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
  
  return `${skipText} this ${period === 'weekly' ? 'week' : 'month'}`;
};

const load = async (silent = false) => {

  if (!silent) loading.value = true;
  try {
    const [h, l] = await Promise.all([
      api.getHabits(), 
      api.getLogs(startDate, endDate),
      refreshSocial()
    ]);
    habits.value = h;
    logs.value = l;

  } catch (error) {
    console.error('[My Habits] load() failed:', error);
  } finally {
    loading.value = false;
  }
};



const getHabitStatusMap = (habitId: string) => {
  const map: Record<string, string> = {};
  logs.value.filter(l => l.habitId === habitId).forEach(l => {
    map[l.date] = l.status;
  });
  return map;
};

const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const referenceRef = ref<HTMLElement | null>(null);

const activeHabitForMenu = computed(() => {
  if (!activeLogMenu.value) return null;
  return habits.value.find(h => h.id === activeLogMenu.value?.habitId) || (editingHabit.value?.id === activeLogMenu.value?.habitId ? editingHabit.value : null);
});
const openLogMenu = (habit: Habit, day: Date, event: MouseEvent, options?: { skipsPeriod?: any, skipsCount?: number }) => {
  if (!isMarkable(day)) {
    showToast('You can only update habits for the last 14 days', 'failed');
    return;
  }
  
  // Capture temporary skip settings from Edit Modal if provided
  if (options) {
    editSkipsPeriod.value = options.skipsPeriod;
    editSkipsCount.value = options.skipsCount;
  } else {
    editSkipsPeriod.value = undefined;
    editSkipsCount.value = undefined;
  }

  if (activeLogMenu.value && activeLogMenu.value.habitId === habit.id && isSameDay(activeLogMenu.value.date, day)) {
    activeLogMenu.value = null;
    referenceRef.value = null;
  } else {
    const el = (event.target as HTMLElement).closest('button');
    if (el) {
      referenceRef.value = el;
      activeLogMenu.value = { habitId: habit.id, date: day };
    }
  }
};

const closeLogMenu = () => {
  activeLogMenu.value = null;
};


const setLogStatus = async (habit: Habit, day: Date, nextStatus: 'completed' | 'failed' | 'skipped' | 'vacation' | null) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const originalLogs = JSON.parse(JSON.stringify(logs.value));
  const originalHabits = JSON.parse(JSON.stringify(habits.value));

  // 1. Optimistic UI Update
  if (nextStatus) {
    const idx = logs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
    const existingLog = logs.value[idx];
    if (existingLog) {
      existingLog.status = nextStatus;
    } else {
      logs.value.push({
        id: `temp-${Date.now()}`,
        habitId: habit.id,
        ownerId: user.value?.id || '',
        date: dateStr,
        status: nextStatus,
        sharedWith: habit.sharedWith || []
      });
    }
    
    if (nextStatus === 'completed') showToast('Completed', 'completed');
    else if (nextStatus === 'failed') showToast('Failed', 'failed');
    else if (nextStatus === 'skipped') showToast('Skipped', 'skipped');
    else if (nextStatus === 'vacation') showToast('On Vacation!', 'skipped');
  } else {
    logs.value = logs.value.filter(l => !(l.habitId === habit.id && l.date === dateStr));
    showToast('Cleared', 'cleared');
  }

  activeLogMenu.value = null;

  // 2. Background Sync
  try {
    if (nextStatus) {
      const { log, habit: updatedHabit } = await api.upsertLog({ 
        habitId: habit.id, 
        date: dateStr, 
        status: nextStatus, 
        sharedWith: habit.sharedWith 
      });
      
      // Update with real server data (ensures correct IDs and recalculated streaks)
      const idx = logs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
      if (idx >= 0) logs.value[idx] = log;
      
      const habitIdx = habits.value.findIndex(h => h.id === habit.id);
      if (habitIdx >= 0) habits.value[habitIdx] = updatedHabit;
    } else {
      const { log, habit: updatedHabit } = await api.deleteLog(habit.id, dateStr);
      
      // Update logs array with the 'cleared' record
      const idx = logs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
      if (idx >= 0) logs.value[idx] = log;
      else logs.value.push(log);

      // Update habits array with returned habit (updated streaks)
      const habitIdx = habits.value.findIndex(h => h.id === habit.id);
      if (habitIdx >= 0) habits.value[habitIdx] = updatedHabit;
    }
  } catch (error) {
    console.error('[Optimistic Update] Sync failed:', error);
    // 3. Revert on failure
    logs.value = originalLogs;
    habits.value = originalHabits;
    showToast('Failed to sync. Reverting...', 'failed');
  }
};

const handleHabitAdd = async (data: any) => {
  if (isAddingHabit.value) return;
  isAddingHabit.value = true;
  try {
    const habit = await api.createHabit({ 
      ...data,
      color: '#6366f1',
      userDate: format(new Date(), 'yyyy-MM-dd')
    });
    habits.value.unshift(habit);
    showModal.value = false;
  } catch (error) {
    console.error('[My Habits] Failed to add habit:', error);
    showToast('Failed to create habit', 'failed');
  } finally {
    isAddingHabit.value = false;
  }
};

const onHabitUpdatedFromModal = ({ habit, logs: newLogs }: { habit?: Habit, logs?: HabitLog[] }) => {
  if (habit) {
    const idx = habits.value.findIndex(h => h.id === habit.id);
    if (idx >= 0) habits.value[idx] = habit;
  }
  if (newLogs) {
    newLogs.forEach(nl => {
      const idx = logs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) logs.value[idx] = nl;
      else logs.value.push(nl);
    });
  }
};

const onHabitDeletedFromModal = (habitId: string) => {
  habits.value = habits.value.filter(h => h.id !== habitId);
};

const openEditModal = (habit: Habit) => {
  editingHabit.value = habit;
  showEditModal.value = true;
};
// --- Modal State Management ---
const modalContent = ref<HTMLElement | null>(null);

const isAnyModalOpen = computed(() => 
  showModal.value || showReorderModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showReorderModal.value = false;
});




const { subscribeToFriendHabits, subscribeToUserBuckets } = useRealtime();
let unsubscribeOwnHabits = () => {};
let unsubscribeOwnBuckets = () => {};

// Social integration is now handled by useSocial

onMounted(() => {
  // Social state is now initialized globally in default.vue layout
  load();
  api.sync();
});

watch(lastSyncTime, () => {
  console.log('[Dashboard] Background sync detected, refreshing data...');
  load(true);
});

watch(() => user.value?.id, (newId) => {
  unsubscribeOwnHabits();
  if (newId) {

    unsubscribeOwnHabits = subscribeToFriendHabits(String(newId), (eventName: string, data: any) => {

      
      if (eventName === 'habit-updated' && data?.log && data?.habit) {
        // Update specific log
        const logIdx = logs.value.findIndex(l => 
          l.id === data.log.id || 
          (l.habitId === data.log.habitId && l.date === data.log.date)
        );
        if (logIdx >= 0) logs.value[logIdx] = data.log;
        else logs.value.push(data.log);

        // Update specific habit (for streaks)
        const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
        if (habitIdx >= 0) {
          habits.value[habitIdx] = data.habit;
        } else {
          // New habit from another session, need to sync Dexie
          api.sync();
        }

      } else if (eventName === 'habit-deleted') {
        const hid = data?.habitId;
        if (hid && data?.date) {
          // Specific log was deleted
          logs.value = logs.value.filter(l => !(l.habitId === hid && l.date === data.date));
          if (data.habit) {
            const habitIdx = habits.value.findIndex(h => h.id === data.habit.id);
            if (habitIdx >= 0) habits.value[habitIdx] = data.habit;
          }
          // Note: Specific log deletions are currently handled as 'cleared' status in logs,
          // so standard sync will pick them up.
        } else if (hid) {
          // Entire habit was deleted
          habits.value = habits.value.filter(h => h.id !== hid);
          logs.value = logs.value.filter(l => l.habitId !== hid);
          // Trigger sync to purge from Dexie
          api.sync();
        } else {
          api.sync();
        }
      } else {
        // Generic fallback for reorder or other updates
        api.sync();
      }
    });

    unsubscribeOwnBuckets = subscribeToUserBuckets(String(newId), (eventName: string, data: any) => {
      if (eventName === 'bucket-deleted') {
        api.sync();
      } else {
        api.sync();
      }
    });
  }
}, { immediate: true });

onUnmounted(() => {
  // cleanupSocial(); // Now a no-op singleton cleanup handled by logout
  unsubscribeOwnHabits();
  unsubscribeOwnBuckets();
});
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
</script>
