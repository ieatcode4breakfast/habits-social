<template>
  <div class="space-y-1 relative">
    <!-- Header -->
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 sticky top-[57px] z-40 bg-black pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-1">
        <button @click="handleBack" class="inline-flex items-center justify-center p-1 -ml-1 text-zinc-500 hover:text-white transition-all flex-shrink-0 cursor-pointer">
          <ChevronLeft class="w-6 h-6" />
        </button>
        <div v-if="profile" class="flex items-center gap-4 ml-1">
          <UserAvatar 
            :src="profile.photourl" 
            container-class="w-12 h-12 bg-zinc-925 rounded-2xl shadow-sm"
            icon-class="w-6 h-6 text-zinc-600"
          />
          <div>
            <h1 class="text-xl font-bold tracking-tight text-white mb-1">{{ profile.username }}</h1>
            <p class="text-zinc-400 text-xs">{{ habits.length }} habit{{ habits.length === 1 ? '' : 's' }} shared with you</p>
          </div>
        </div>
      </div>

      <!-- Action Row -->
      <div v-if="profile && !loading" class="flex items-center gap-2">
        <button v-if="relationshipStatus === 'friends'" @click="openShareModal" class="w-11 sm:w-auto py-2.5 sm:px-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95" title="Share Habits">
          <Share2 class="w-4 h-4" />
          <span class="hidden sm:inline">Share</span>
        </button>
        <button v-if="relationshipStatus === 'friends'" @click="showUnfriendModal = true" class="w-11 sm:w-auto py-2.5 sm:px-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95" title="Unfriend">
          <UserMinus class="w-4 h-4" />
          <span class="hidden sm:inline">Unfriend</span>
        </button>
        <button v-if="relationshipStatus === 'none'" @click="executeSendRequest" class="w-11 sm:w-auto py-2.5 sm:px-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95">
          <UserPlus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
        <button v-else-if="relationshipStatus === 'pending_incoming'" @click="executeAcceptRequest" class="w-11 sm:w-auto py-2.5 sm:px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95">
          <Check class="w-4 h-4" />
          <span class="hidden sm:inline">Accept</span>
        </button>
        <button v-else-if="relationshipStatus === 'pending_outgoing'" @click="showCancelRequestModal = true" class="py-2.5 px-4 bg-zinc-925 hover:bg-zinc-900 text-zinc-500 font-semibold rounded-xl border border-zinc-800 transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95">
          Pending
        </button>
      </div>
    </div>

    <!-- Shared Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-2xl rounded-none shadow-2xl border-y border-x-0 sm:border border-zinc-800/80 divide-y divide-zinc-800/80 overflow-x-auto custom-scrollbar">
      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        {{ profile?.username }} hasn't shared any habits with you yet.
      </div>
      
      <div v-for="habit in habits" :key="habit.id" 
           @click="openHabitDetails(habit)"
           class="p-4 pt-14 sm:pt-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 relative group cursor-pointer hover:bg-zinc-925/50 transition-colors">
        
        <!-- Top Left Badges Container -->
        <div class="absolute top-3 left-0 sm:top-2 flex items-center gap-2 z-20 transition-all duration-500">
          <!-- Floating Streak Badge -->
          <div 
            v-if="(habit.currentStreak ?? 0) >= 2"
            class="flex items-center gap-1.5 px-3 py-1 bg-black border border-l-0 rounded-r-full rounded-l-none transition-all duration-500"
            :class="[
              isFaded(habit) ? 'opacity-30' : 'opacity-100',
              getStreakTheme(habit.currentStreak ?? 0).border
            ]"
          >
            <span 
              class="text-[10px] font-black tracking-tight"
              :class="getStreakTheme(habit.currentStreak ?? 0).text"
            >
              x{{ habit.currentStreak }} STREAK
            </span>
            <Flame 
              v-if="(habit.currentStreak ?? 0) >= 7"
              class="w-3.5 h-3.5" 
              :class="[
                getStreakTheme(habit.currentStreak ?? 0).text,
                getStreakTheme(habit.currentStreak ?? 0).fill
              ]"
            />
          </div>

          <!-- Frequency Progress Badge -->
          <div class="flex items-center px-2 py-1 bg-zinc-925 border border-zinc-800 rounded-lg text-[10px] font-bold tracking-tight text-zinc-400 shadow-sm" :class="{'ml-3': (habit.currentStreak ?? 0) < 2}">
            {{ getFrequencyText(habit) }}
          </div>
        </div>

        <!-- Title Section -->
        <div class="flex items-center gap-3 min-w-[200px] flex-1">
          <div class="text-left flex items-start gap-2 relative">
            <h3 class="font-bold text-zinc-200 leading-tight break-all group-hover:text-white transition-colors">{{ habit.title }}</h3>
          </div>
        </div>
        
        <!-- Checkboxes Section -->
        <div class="flex-1 min-w-[320px] flex justify-center sm:justify-end items-end gap-4">
          <div class="flex justify-evenly items-end w-full max-w-lg">
            <div v-for="(day, i) in days" :key="i" class="flex flex-col items-center gap-2">
              <div class="text-[10px] uppercase tracking-tighter text-zinc-500 font-black">
                {{ format(day, 'EEE') }}
              </div>
              
              <div
                class="w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all relative"
                :class="[
                  getStatus(habit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                  getStatus(habit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                  getStatus(habit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                  'border-dashed border-zinc-800 bg-transparent'
                ]"
              >
                <Check v-if="getStatus(habit.id, day) === 'completed'" class="w-4 h-4 text-white" />
                <XIcon v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
              </div>

              <div class="text-[10px] font-bold text-white">
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- View Habit Details Modal -->
    <HabitDetailsModal
      v-model="showModal"
      :habit="selectedHabit"
      :logs="logs"
      :loading="calendarLoading"
      @month-changed="handleFriendMonthChanged"
    />

    <!-- Share Habits Modal -->
    <ShareHabitsModal
      v-model="showShareModal"
      :title="shareModalTitle"
      :target-user="profile"
      :my-habits="myHabits"
      :initial-selected-ids="selectedHabitIds"
      @shared="executeBatchShareRefresh"
    />

    <!-- Unfriend Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showUnfriendModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showUnfriendModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserMinus class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Unfriend?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Are you sure you want to unfriend <span class="text-zinc-200 font-medium">{{ profile?.username }}</span>?
            </p>
            <div class="flex gap-3 mt-2">
              <button @click="showUnfriendModal = false" class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
              <button @click="executeUnfriend" class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer">
                Unfriend
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- Cancel Request Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showCancelRequestModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showCancelRequestModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserMinus class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Cancel Request?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Are you sure you want to cancel your friend request to <span class="text-zinc-200 font-medium">{{ profile?.username }}</span>?
            </p>
            <div class="flex gap-3 mt-2">
              <button @click="showCancelRequestModal = false" class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">
                Go Back
              </button>
              <button @click="executeCancelRequest" class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, User, Flame, X as XIcon, ChevronRight, Check, Minus, UserPlus, CheckSquare, Share2, UserMinus } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, getDaysInMonth, parseISO, startOfWeek } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';
import { useSocial } from '~/composables/useSocial';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const friendId = route.params.id as string;

const { friendships, refresh: refreshSocial } = useSocial();
const { user } = useAuth();

const friendship = computed(() => {
  return friendships.value.find(f => f.participants.includes(friendId));
});

const backLink = computed(() => {
  const from = route.query.from as string;
  if (from) return `/social?tab=${from}`;
  return '/social?tab=friends';
});

const router = useRouter();
const handleBack = () => {
  // If we have a 'from' query param, it's highly likely we just came from the social page.
  // router.back() is better for preserving scroll position in KeepAlive scenarios.
  if (route.query.from) {
    router.back();
  } else {
    navigateTo(backLink.value);
  }
};

const relationshipStatus = computed(() => {
  if (!friendship.value) return 'none';
  if (friendship.value.status === 'accepted') return 'friends';
  if (friendship.value.initiatorId === String(user.value?.id)) return 'pending_outgoing';
  return 'pending_incoming';
});

// Share Modal State
const showShareModal = ref(false);
const showUnfriendModal = ref(false);
const showCancelRequestModal = ref(false);
const myHabits = ref<any[]>([]);
const selectedHabitIds = ref<string[]>([]);
const shareModalTitle = ref('Request Sent!');

const openShareModal = async () => {
  const habitsData = await $fetch<any[]>('/api/habits');
  myHabits.value = habitsData;
  // Pre-select habits already shared with this friend
  selectedHabitIds.value = habitsData
    .filter((h: any) => h.sharedwith?.includes(friendId))
    .map((h: any) => h.id);
  
  shareModalTitle.value = 'Share Habits';
  showShareModal.value = true;
};

const toggleHabitSelection = (id: string) => {
  const index = selectedHabitIds.value.indexOf(id);
  if (index === -1) selectedHabitIds.value.push(id);
  else selectedHabitIds.value.splice(index, 1);
};

const toggleSelectAllHabits = () => {
  if (selectedHabitIds.value.length === myHabits.value.length) {
    selectedHabitIds.value = [];
  } else {
    selectedHabitIds.value = myHabits.value.map((h: any) => h.id);
  }
};

const executeSendRequest = async () => {
  await $fetch('/api/social/friends', { method: 'POST', body: { targetUserId: friendId } });
  await refreshSocial();
  
  const habitsData = await $fetch<any[]>('/api/habits');
  myHabits.value = habitsData;
  selectedHabitIds.value = [];
  
  if (habitsData.length > 0) {
    shareModalTitle.value = 'Request Sent!';
    showShareModal.value = true;
  }
};

const executeAcceptRequest = async () => {
  if (!friendship.value) return;
  await $fetch(`/api/social/requests/${friendship.value.id}`, { method: 'PUT' });
  await refreshSocial();

  const habitsData = await $fetch<any[]>('/api/habits');
  myHabits.value = habitsData;
  selectedHabitIds.value = [];
  
  if (habitsData.length > 0) {
    shareModalTitle.value = 'Request Accepted!';
    showShareModal.value = true;
  }
};

const executeBatchShareRefresh = async () => {
  showShareModal.value = false;
  load(); // Reload friend data to see if anything changed
};

const executeUnfriend = async () => {
  if (!friendship.value) return;
  await $fetch(`/api/social/requests/${friendship.value.id}`, { method: 'DELETE' });
  await refreshSocial();
  showUnfriendModal.value = false;
  navigateTo('/social?tab=friends');
};

const executeCancelRequest = async () => {
  if (!friendship.value) return;
  await $fetch(`/api/social/requests/${friendship.value.id}`, { method: 'DELETE' });
  await refreshSocial();
  showCancelRequestModal.value = false;
};

const profile = ref<any>(null);
const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const loading = ref(true);

const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));

// Modal and Calendar State
const showModal = ref(false);
const selectedHabit = ref<Habit | null>(null);
const currentCalendarDate = ref(new Date());
const calendarLoading = ref(false);

const isAnyModalOpen = computed(() => showModal.value || showShareModal.value || showUnfriendModal.value || showCancelRequestModal.value);

useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showShareModal.value = false;
  showUnfriendModal.value = false;
  showCancelRequestModal.value = false;
});

const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(today));

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

const prevMonth = () => currentCalendarDate.value = subMonths(currentCalendarDate.value, 1);
const nextMonth = () => currentCalendarDate.value = addMonths(currentCalendarDate.value, 1);

const isFaded = (habit: Habit) => {
  if (!habit || !habit.streakAnchorDate) return false;
  const anchor = startOfDay(parseISO(habit.streakAnchorDate));
  const yesterday = startOfDay(subDays(new Date(), 1));
  return isAfter(yesterday, anchor);
};

const getStreakTheme = (count: number) => {
  if (count >= 30) return { 
    border: 'border-yellow-400/50 shadow-lg shadow-yellow-400/10', 
    text: 'text-yellow-400', 
    fill: 'fill-yellow-400/80' 
  };
  if (count >= 7) return { 
    border: 'border-violet-400/50 shadow-lg shadow-violet-400/10', 
    text: 'text-violet-400', 
    fill: 'fill-violet-400/80' 
  };
  return { 
    border: 'border-emerald-500/50', 
    text: 'text-emerald-500', 
    fill: 'fill-emerald-500/80' 
  };
};

const getFrequencyText = (habit: Habit) => {
  const period = habit.frequencyPeriod;
  const count = habit.frequencyCount || 1;
  const now = new Date();

  if (period === 'daily') {
    let completed = 0;
    for (const l of logs.value) {
      if (l.habitid === habit.id && isToday(new Date(l.date)) && l.status === 'completed') {
        completed++;
      }
    }
    return completed >= 1 ? 'Target completed' : 'Daily, no skips';
  } else if (period === 'weekly') {
    const target = count;
    const maxSkips = 7 - target;
    
    let completed = 0;
    let skipped = 0;
    
    for (const l of logs.value) {
      if (l.habitid === habit.id && isSameWeek(new Date(l.date), now, { weekStartsOn: 0 })) {
        if (l.status === 'completed') completed++;
        else if (l.status === 'skipped') skipped++;
      }
    }
    
    if (completed >= target) return 'Weekly target completed';
    
    if (maxSkips === 0) {
      return `Weekly, ${completed}/${target}, no skips`;
    } else {
      const remainingSkips = Math.max(0, maxSkips - skipped);
      const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
      return `Weekly, ${completed}/${target}, ${skipText}`;
    }
  } else if (period === 'monthly') {
    const daysInMonth = getDaysInMonth(now);
    const target = Math.min(count, daysInMonth);
    const maxSkips = daysInMonth - target;
    
    let completed = 0;
    let skipped = 0;
    
    for (const l of logs.value) {
      if (l.habitid === habit.id && isSameMonth(new Date(l.date), now)) {
        if (l.status === 'completed') completed++;
        else if (l.status === 'skipped') skipped++;
      }
    }
    
    if (completed >= target) return 'Monthly target completed';
    
    if (maxSkips === 0) {
      return `Monthly, ${completed}/${target}, no skips`;
    } else {
      const remainingSkips = Math.max(0, maxSkips - skipped);
      const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
      return `Monthly, ${completed}/${target}, ${skipText}`;
    }
  }
  return '';
};

const openHabitDetails = (habit: Habit) => {
  selectedHabit.value = habit;
  currentCalendarDate.value = new Date();
  showModal.value = true;
};

const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitid === habitId && l.date === dateStr)?.status;
};

const load = async () => {
  loading.value = true;
  try {

    const [profileData, sharedData] = await Promise.all([
      $fetch('/api/social/profile', { query: { friendId } }),
      $fetch('/api/social/friend-data', { query: { friendId } })
    ]);
    


    profile.value = profileData as any;
    habits.value = (sharedData as any).habits || [];
    logs.value = (sharedData as any).logs || [];
  } catch (error: any) {
    console.error('Error loading friend profile:', error);
    // Check if it's a 404 or other specific error
    if (error.statusCode === 400) {
      console.error('Invalid ID format');
    }
  } finally {
    loading.value = false;
  }
};



const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.some(l => l.habitid === habitId && l.date === dateStr && l.status === 'completed');
};

// --- Dynamic Log Fetching ---
const handleFriendMonthChanged = async (newDate: Date) => {
  if (!selectedHabit.value) return;
  const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
  const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
  calendarLoading.value = true;
  try {
    const data = await $fetch<any>('/api/social/habit-details', { 
      query: { 
        habitId: selectedHabit.value.id,
        startDate: start,
        endDate: end
      } 
    });
    if (data.logs) {
      data.logs.forEach((newLog: any) => {
        const idx = logs.value.findIndex((l: any) => l.id === newLog.id);
        if (idx >= 0) {
          logs.value[idx] = newLog;
        } else {
          logs.value.push(newLog);
        }
      });
    }
  } catch (err) {
    console.error('Failed to fetch historical friend logs:', err);
  } finally {
    calendarLoading.value = false;
  }
};
// ----------------------------

// --- Modal State Management ---
const modalContent = ref<HTMLElement | null>(null);
const shareModalContent = ref<HTMLElement | null>(null);

const { subscribeToFriendHabits } = useRealtime();
let unsubscribeHabits = () => {};

onMounted(() => {
  load();
  unsubscribeHabits = subscribeToFriendHabits(friendId, () => {
    load();
  });
});

onUnmounted(() => {
  unsubscribeHabits();
});
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
</script>
