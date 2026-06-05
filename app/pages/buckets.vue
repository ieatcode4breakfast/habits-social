<template>
  <div class="relative">
    <!-- Sticky Header + Date Row -->
    <div class="sticky top-0 md:top-[57px] z-40 bg-black">
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-3">
        <PaintBucket class="w-7 h-7 text-zinc-400 shrink-0" />
        <div>
          <h1 class="text-base font-bold tracking-tight text-white">Buckets</h1>
          <p class="text-zinc-400 text-xs">{{ buckets.length }} bucket{{ buckets.length === 1 ? '' : 's' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="buckets.length > 1"
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
          title="Add Bucket"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
    <!-- Date Header -->
    <div class="bg-date-header-bg border-b sm:border-t border-x-0 sm:border-x border-zinc-800/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block sm:pr-2"></div>
        <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
          <div class="flex items-end w-full">
            <div v-for="(day, i) in days" :key="i" class="flex-1 flex flex-col items-center relative">
              <!-- Sunday Divider -->
              <div 
                v-if="i > 0 && day.getDay() === 0" 
                class="absolute left-0 top-0 bottom-0 w-px bg-zinc-800/80"
              ></div>
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

    <!-- Bucket Edit/Add Modal -->
    <BucketModal
      v-model="showBucketModal"
      :bucket="editingBucket"
      :available-habits="availableHabits"
      :status-map="currentBucketStatusMap"
      :loading="calendarLoading"
      :saving="isSavingBucket"
      @save="handleBucketSave"
      @delete="showDeleteModal = true"
      @change-month="onBucketCalendarMonthChange"
    />

    <!-- Habit Edit Modal -->
    <HabitEditModal
      v-model="showHabitEditModal"
      :habit="editingHabit"
      :friends="friends"
      :logs="habitLogs"
      @habit-updated="onHabitUpdated"
      @habit-deleted="onHabitDeleted"
      @open-log-menu="openLogMenu"
    />

    <!-- Reorder Modal -->
    <ReorderModal
      v-model="showReorderModal"
      title="Reorder buckets"
      :items="buckets"
      @reorder="onBucketsReordered"
    />

    <!-- Delete Modal -->
    <BucketDeleteModal
      v-model="showDeleteModal"
      :bucket-title="editingBucket?.title || ''"
      :loading="isDeletingBucket"
      @confirm="handleDelete"
    />

    <!-- Bucket List -->
    <div v-motion-fade :style="pullStyle" 
         class="buckets-content-surface sm:rounded-b-2xl rounded-none overflow-hidden border-b border-x-0 sm:border-x sm:border-b relative will-change-transform transition-colors duration-300"
         :class="!loading ? 'backdrop-blur-md bg-zinc-925/80 border-zinc-800/80 shadow-2xl' : 'border-transparent'">

      <div class="w-full relative min-h-[100px]">
        <div v-if="loading" class="flex justify-center items-center p-12 min-h-[150px] w-full">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
        <div v-else-if="buckets.length === 0" class="flex justify-center items-center p-10 text-center text-zinc-500 italic text-sm w-full min-h-[150px]">
          No buckets yet. Add one above!
        </div>
      
        <div v-else ref="sortableContainer" class="w-full divide-y divide-zinc-800/80">
          <div 
            v-for="bucket in buckets" :key="bucket.id"
            :data-bucket-id="bucket.id"
            class="relative transition-colors bg-zinc-925/80 sortable-item"
          >
          <!-- Bucket Header Row -->
          <div 
            @click="toggleExpand(bucket.id)"
            class="relative py-3 group transition-all duration-300 ease-out flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-zinc-800/40 sm:px-4"
          >
            <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-0.5 sm:pr-2">
              <div class="flex items-start gap-2">
                <ChevronRight 
                  class="w-4 h-4 text-zinc-600 transition-transform duration-300 mt-0.5 shrink-0"
                  :class="expandedBucketId === bucket.id ? 'rotate-90 text-white' : ''"
                />
                <h3 class="text-sm font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors flex-1 min-w-0">
                  {{ bucket.title }}
                  
                  <!-- Streak Badge -->
                  <span 
                    v-if="(bucket.currentStreak ?? 0) >= 2"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-black border rounded-md shrink-0 align-middle ml-1.5"
                    :class="[
                      isFaded(bucket) ? 'opacity-30' : 'opacity-100',
                      getStreakTheme(bucket.currentStreak ?? 0).border
                    ]"
                  >
                    <Flame 
                      v-if="(bucket.currentStreak ?? 0) >= 7"
                      class="w-2.5 h-2.5" 
                      :class="[
                        getStreakTheme(bucket.currentStreak ?? 0).text,
                        getStreakTheme(bucket.currentStreak ?? 0).fill
                      ]"
                    />
                    <span 
                      class="text-[9px] font-black tracking-tight"
                      :class="getStreakTheme(bucket.currentStreak ?? 0).text"
                    >
                      x{{ bucket.currentStreak }} STREAK
                    </span>
                  </span>
                </h3>
              </div>
              
              <div class="hidden sm:flex items-center gap-2">
                <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-medium ml-6">
                  <span>{{ getHabitsInBucket(bucket).length }} habits</span>
                  <button 
                    @click.stop="openEditModal(bucket)"
                    class="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                  >
                    <Edit2 class="w-3 h-3 text-zinc-600" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Read-only Timeline -->
            <TimelineRow
              :days="days"
              :status-map="getBucketStatusMap(bucket.id)"
              cell-shape="square"
            />

            <!-- Mobile Habit Count: below timeline -->
            <div class="sm:hidden px-4 pt-1">
              <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-medium ml-6">
                <span>{{ getHabitsInBucket(bucket).length }} habits</span>
                <button 
                  @click.stop="openEditModal(bucket)"
                  class="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                >
                  <Edit2 class="w-3 h-3 text-zinc-600" />
                </button>
              </div>
            </div>

          </div>

          <!-- Expanded Content: Habit List -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out overflow-hidden"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-[1000px] opacity-100"
            leave-active-class="transition-all duration-200 ease-in overflow-hidden"
            leave-from-class="max-h-[1000px] opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div v-if="expandedBucketId === bucket.id" class="border-t border-zinc-800/50">

              <div v-if="getHabitsInBucket(bucket).length === 0" class="py-6 text-center text-zinc-500 text-sm italic">
                No habits in this bucket.
              </div>
              <div v-else class="divide-y divide-zinc-800/30">
                  <div v-for="(habit, hIdx) in getHabitsInBucket(bucket)" :key="habit.id" 
                    class="flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 py-3 rounded-xl transition-all hover:bg-white/[0.03] group/habit-row sm:px-4"
                  >
                    <div 
                      class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex items-center gap-2 cursor-pointer group/habit"
                      @click.stop="openHabitEditModal(habit)"
                    >
                      <div class="w-4 h-4 shrink-0"></div>
                      <div class="min-w-0 flex-1 flex items-center gap-2">
                        <span class="text-xs sm:text-sm font-bold text-zinc-400 group-hover/habit:text-white transition-colors truncate">{{ habit.title }}</span>
                        
                        <!-- Habit Streak Pill -->
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
                            class="text-[9px] font-black tracking-tight"
                            :class="getStreakTheme(habit.currentStreak ?? 0).text"
                          >
                            x{{ habit.currentStreak }} STREAK
                          </span>
                        </div>
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
              </div>
            </div>
          </Transition>
        </div>
        </div>
      </div>
    </div>

    <!-- Global Log Menu -->
    <LogMenu
      :habit="activeHabitForMenu || null"
      :date="activeLogMenu?.date || null"
      :logs="habitLogs"
      :reference-el="referenceRef"
      @select="setLogStatus"
      @close="closeLogMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, Flame, PaintBucket, Palmtree, Edit2, ChevronDown, ChevronUp, ArrowUpDown, GripVertical, CheckSquare } from 'lucide-vue-next';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, parseISO, isToday, startOfWeek, addDays, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import type { Bucket, BucketLog, Habit, HabitLog } from '~/composables/useHabitsApi';
import { getStreakTheme, isStreakFaded as isFaded, autoExpandTextarea as autoExpand, isMarkable } from '~/utils/ui';
import { useSortable } from '@vueuse/integrations/useSortable';
import { useCalendar } from '~/composables/useCalendar';

type LogMenuStatus = Exclude<HabitLog['status'], 'cleared'> | null;

definePageMeta({ middleware: 'auth' });

const api = useHabitsApi();
const { user } = useAuth();
const { friends } = useSocial();
const { lastSyncTime } = api;
const { showToast } = useToast();

const { pullDistance, isPulling, isRefreshing } = usePullToRefresh(async () => {
  await load();
});

const pullStyle = computed(() => {
  const useTransition = !isPulling.value && !loading.value && !isRefreshing.value;
  return {
    transform: 'translateY(var(--pull-distance, 0px))',
    transition: useTransition ? 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
  };
});

useSeoMeta({
  title: 'Buckets - Habits Social',
  description: 'Organize your habits into custom buckets on Habits Social.',
});

let lastLoadSequence = 0;
const buckets = ref<Bucket[]>([]);
const habitLogs = ref<HabitLog[]>([]);
const bucketLogs = ref<BucketLog[]>([]);
const availableHabits = ref<Habit[]>([]);
const loading = ref(true);
const { checkLimit } = useBucketLimit(buckets);

const showBucketModal = ref(false);
const showReorderModal = ref(false);
const showDeleteModal = ref(false);
const showHabitEditModal = ref(false);
const editingBucket = ref<Bucket | null>(null);
const editingHabit = ref<Habit | null>(null);
const isSavingBucket = ref(false);
const isDeletingBucket = ref(false);

const { 
  currentDate: currentCalendarDate, 
  days: calendarDays, 
  prevMonth, 
  nextMonth 
} = useCalendar();



const calendarLoading = ref(false);
const expandedBucketId = ref<string | null>(null);
const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const referenceRef = ref<HTMLElement | null>(null);

const onBucketCalendarMonthChange = async (newDate: Date) => {
  const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
  const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
  calendarLoading.value = true;
  try {
    const [newHabitLogs, newBucketLogs] = await Promise.all([
      api.getLogs(start, end),
      api.getBucketLogs(start, end)
    ]);
    
    // Merge logs
    newHabitLogs.forEach(nl => {
      const idx = habitLogs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) habitLogs.value[idx] = nl;
      else habitLogs.value.push(nl);
    });
    
    newBucketLogs.forEach(nl => {
      const idx = bucketLogs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) bucketLogs.value[idx] = nl;
      else bucketLogs.value.push(nl);
    });
  } catch (err) {
    console.error('[Buckets] Failed to fetch historical logs:', err);
  } finally {
    calendarLoading.value = false;
  }
};

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
const startDate = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
const endDate = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd');

const toggleExpand = (bucketId: string) => {
  const isOpening = expandedBucketId.value !== bucketId;
  expandedBucketId.value = isOpening ? bucketId : null;

  if (isOpening) {
    nextTick(() => {
      const el = document.querySelector(`[data-bucket-id="${bucketId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const offset = 80; // Account for sticky header
        const top = window.pageYOffset + rect.top - offset;
        
        window.scrollTo({
          top,
          behavior: 'smooth'
        });
      }
    });
  }
};

const getHabitsInBucket = (bucket: Bucket) => {
  if (!bucket.habitIds) return [];
  return availableHabits.value.filter(h => bucket.habitIds.includes(h.id));
};

const activeHabitForMenu = computed(() => {
  if (!activeLogMenu.value) return null;
  return availableHabits.value.find(h => h.id === activeLogMenu.value?.habitId);
});

const openLogMenu = (habit: Habit, day: Date, event: MouseEvent) => {
  if (!isMarkable(day)) {
    showToast('You can only update habits for the last 7 days', 'failed');
    return;
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
  referenceRef.value = null;
};

const setLogStatus = async (habit: Habit, day: Date, status: LogMenuStatus) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  activeLogMenu.value = null;
  referenceRef.value = null;

  try {
    const { log, habit: updatedHabit } = status === null
      ? await api.deleteLog(habit.id, dateStr)
      : await api.upsertLog({
        habitId: habit.id,
        date: dateStr,
        status,
        sharedWith: habit.sharedWith
      });

    const logIdx = habitLogs.value.findIndex(l => l.habitId === habit.id && l.date === dateStr);
    if (logIdx >= 0) {
      habitLogs.value[logIdx] = log;
    } else {
      habitLogs.value.push(log);
    }

    const habitIdx = availableHabits.value.findIndex(h => h.id === habit.id);
    if (habitIdx >= 0) {
      availableHabits.value[habitIdx] = updatedHabit;
    }

    const firstVisibleDay = days[0] ?? day;
    const lastVisibleDay = days[days.length - 1] ?? day;
    const visibleStart = format(firstVisibleDay, 'yyyy-MM-dd');
    const visibleEnd = format(lastVisibleDay, 'yyyy-MM-dd');
    const refreshedBucketLogs = await api.getBucketLogs(visibleStart, visibleEnd);
    bucketLogs.value = [
      ...bucketLogs.value.filter(l => l.date < visibleStart || l.date > visibleEnd),
      ...refreshedBucketLogs
    ];
  } catch (error) {
    console.error('[Buckets] Failed to update log:', error);
    showToast('Failed to update log', 'failed');
  }
};

const getBucketStatusMap = (bucketId: string) => {
  const map: Record<string, string> = {};
  bucketLogs.value.filter(l => l.bucketId === bucketId).forEach(l => {
    map[l.date] = l.status;
  });
  return map;
};

const getHabitStatusMap = (habitId: string) => {
  const map: Record<string, string> = {};
  habitLogs.value.filter(l => l.habitId === habitId).forEach(l => {
    map[l.date] = l.status;
  });
  return map;
};

const currentBucketStatusMap = computed(() => {
  if (!editingBucket.value) return {};
  return getBucketStatusMap(editingBucket.value.id);
});

const load = async (silent = false) => {
  const currentSequence = ++lastLoadSequence;
  if (!silent) loading.value = true;
  try {
    const promises: Promise<any>[] = [
      api.getBuckets(), 
      api.getLogs(startDate, endDate),
      api.getBucketLogs(startDate, endDate),
      api.getHabits()
    ];
    if (!silent) {
      promises.push(new Promise(resolve => setTimeout(resolve, 500)));
    }
    const [b, l, bl, h] = await Promise.all(promises);

    if (currentSequence !== lastLoadSequence) return;

    buckets.value = b;
    habitLogs.value = l;
    bucketLogs.value = bl;
    availableHabits.value = h;
  } catch (error) {
    console.error('[Buckets] load() failed:', error);
  } finally {
    if (currentSequence === lastLoadSequence) {
      loading.value = false;
    }
  }
};

const openAddModal = () => {
  if (!checkLimit()) return;
  editingBucket.value = null;
  showBucketModal.value = true;
};

// --- Habit Editing ---
const openHabitEditModal = (habit: Habit) => {
  editingHabit.value = habit;
  showHabitEditModal.value = true;
};

const onHabitUpdated = ({ habit, logs: newLogs }: { habit?: Habit, logs?: HabitLog[] }) => {
  if (habit) {
    const idx = availableHabits.value.findIndex(h => h.id === habit.id);
    if (idx >= 0) availableHabits.value[idx] = habit;
  }
  if (newLogs) {
    newLogs.forEach(nl => {
      const idx = habitLogs.value.findIndex(l => l.id === nl.id);
      if (idx >= 0) habitLogs.value[idx] = nl;
      else habitLogs.value.push(nl);
    });
  }
};

const onHabitDeleted = (habitId: string) => {
  availableHabits.value = availableHabits.value.filter(h => h.id !== habitId);
  buckets.value.forEach(b => {
    if (b.habitIds) b.habitIds = b.habitIds.filter(id => id !== habitId);
  });
};

const openEditModal = (bucket: Bucket) => {
  editingBucket.value = bucket;
  showBucketModal.value = true;
};

const handleBucketSave = async (data: { title: string, description: string, habitIds: string[] }) => {
  if (isSavingBucket.value) return;
  isSavingBucket.value = true;
  try {
    if (editingBucket.value) {
      const updated = await api.updateBucket(editingBucket.value.id, data);
      const idx = buckets.value.findIndex(b => b.id === editingBucket.value?.id);
      if (idx >= 0) buckets.value[idx] = updated;
    } else {
      const created = await api.createBucket({ ...data, color: '#6366f1' });
      buckets.value.unshift(created);
    }
    showBucketModal.value = false;
    load(true);
  } catch (error) {
    console.error('[Buckets] Save failed:', error);
    showToast('Failed to save bucket', 'failed');
  } finally {
    isSavingBucket.value = false;
  }
};

const handleDelete = async () => {
  if (!editingBucket.value || isDeletingBucket.value) return;
  
  isDeletingBucket.value = true;
  try {
    await api.deleteBucket(editingBucket.value.id);
    buckets.value = buckets.value.filter(b => b.id !== editingBucket.value?.id);
    showDeleteModal.value = false;
    showBucketModal.value = false;
    editingBucket.value = null;
  } catch (error) {
    console.error('[Buckets] Failed to delete bucket:', error);
    showToast('Failed to delete bucket', 'failed');
  } finally {
    isDeletingBucket.value = false;
  }
};

// --- Drag-and-drop reorder ---
const sortableContainer = ref<HTMLElement | null>(null);

useSortable(sortableContainer, buckets, {
  watchElement: true,
  draggable: '.sortable-item',
  animation: 250,
  delay: 200, // delay on mobile to prevent accidental drags when scrolling
  delayOnTouchOnly: true,
  touchStartThreshold: 5,
  ghostClass: 'opacity-0',
  dragClass: 'scale-[1.02]',
  forceFallback: true,
  fallbackClass: 'sortable-fallback-opaque',
  fallbackOnBody: true,
  onEnd: () => {
    api.reorderBuckets(buckets.value.map(b => b.id));
  }
});

const onBucketsReordered = (newOrderIds: string[]) => {
  const newBuckets = [];
  for (const id of newOrderIds) {
    const bucket = buckets.value.find(b => b.id === id);
    if (bucket) newBuckets.push(bucket);
  }
  buckets.value = newBuckets;
  api.reorderBuckets(newOrderIds);
};

const isAnyModalOpen = computed(() => 
  showBucketModal.value || showHabitEditModal.value || showDeleteModal.value || showReorderModal.value
);

useModalHistory(isAnyModalOpen, () => {
  showBucketModal.value = false;
  showReorderModal.value = false;
  showDeleteModal.value = false;
});

onMounted(() => {
  load();
  api.sync();
});

watch(lastSyncTime, () => {
  console.log('[Buckets] Background sync detected, refreshing data...');
  load(true);
});

</script>
