<template>
  <div class="relative">
    <!-- Header -->
    <!-- Sticky Wrapper -->
    <div class="sticky top-0 md:top-[57px] z-40 bg-black">
      <!-- Profile Header -->
      <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-black pt-2 pb-2 sm:pt-4">
        <div class="flex items-center gap-1">
          <button @click="handleBack" class="inline-flex items-center justify-center p-1 -ml-1 text-zinc-500 hover:text-white transition-all flex-shrink-0 cursor-pointer">
            <ChevronLeft class="w-6 h-6" />
          </button>
          <div v-if="profile" class="flex items-center gap-4 ml-1">
            <UserAvatar 
              :src="profile.photoUrl" 
              container-class="w-12 h-12 bg-zinc-925 rounded-2xl shadow-sm"
              icon-class="w-6 h-6 text-zinc-600"
            />
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-base font-bold tracking-tight text-white">{{ profile.username }}</h1>
                <button 
                  v-if="relationshipStatus === 'friends'"
                  @click="handleToggleFavorite"
                  class="p-2 transition-all cursor-pointer rounded-xl -ml-1"
                  :class="isFavorite ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-600 hover:text-amber-400 hover:bg-amber-400/5'"
                  title="Toggle Favorite"
                >
                  <Star class="w-4 h-4" :class="{ 'fill-amber-400': isFavorite }" />
                </button>
              </div>
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
          <button 
            v-if="relationshipStatus === 'none'" 
            @click="executeSendRequest" 
            :disabled="isProcessing"
            class="w-11 sm:w-auto py-2.5 sm:px-4 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <template v-if="isProcessing">
              <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
            </template>
            <template v-else>
              <UserPlus class="w-4 h-4" />
              <span class="hidden sm:inline">Add</span>
            </template>
          </button>
          <button 
            v-else-if="relationshipStatus === 'pending_incoming'" 
            @click="executeAcceptRequest" 
            :disabled="isProcessing"
            class="w-11 sm:w-auto py-2.5 sm:px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <template v-if="isProcessing">
              <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </template>
            <template v-else>
              <Check class="w-4 h-4" />
              <span class="hidden sm:inline">Accept</span>
            </template>
          </button>
          <button v-else-if="relationshipStatus === 'pending_outgoing'" @click="showCancelRequestModal = true" class="py-2.5 px-4 bg-zinc-925 hover:bg-zinc-900 text-zinc-500 font-semibold rounded-xl border border-zinc-800 transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95">
            Pending
          </button>
        </div>
      </div>

      <!-- Date Header -->
      <div v-if="habits.length > 0" class="bg-zinc-925 border-b sm:border-t border-x-0 sm:border-x border-zinc-800/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
          <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block pr-0 sm:pr-2"></div>
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

    <!-- Shared Habit List (Single Card) -->
    <div v-motion-fade class="bg-zinc-925/80 backdrop-blur-md sm:rounded-b-2xl rounded-none shadow-2xl border-b border-x-0 sm:border-x sm:border-b border-zinc-800/80 divide-y divide-zinc-800/80 overflow-x-auto custom-scrollbar relative">
      <div v-if="loading" class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
      <template v-else>
        <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        {{ profile?.username }} hasn't shared any habits with you yet.
      </div>
      
      <div v-for="habit in habits" :key="habit.id" 
           @click="openHabitDetails(habit)"
           class="relative py-3 group transition-all flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-zinc-800/40 sm:px-4">
        
        <!-- Title Section -->
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
                class="text-[9px] font-black tracking-tight"
                :class="getStreakTheme(habit.currentStreak ?? 0).text"
              >
                x{{ habit.currentStreak }} STREAK
              </span>
            </div>
          </div>
          <!-- Frequency Text -->
          <div class="text-[10px] font-semibold tracking-tight text-zinc-500">
            {{ getFrequencyText(habit) }}
          </div>
        </div>
        
        <!-- Interactive Logs (Read-only for friends) -->
        <TimelineRow
          :days="days"
          :status-map="getHabitStatusMap(habit.id)"
        />
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
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showUnfriendModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserMinus class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Unfriend?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Are you sure you want to unfriend <span class="text-zinc-200 font-medium">{{ profile?.username }}</span>?
            </p>
            <div class="flex gap-3 mt-2">
              <button @click="showUnfriendModal = false" class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                Cancel
              </button>
              <button @click="executeUnfriend" class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer whitespace-nowrap">
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
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" @click="showCancelRequestModal = false"></div>
          <div class="relative w-full max-w-sm bg-zinc-925 border border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
            <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserMinus class="w-8 h-8 text-rose-500" />
            </div>
            <h2 class="text-xl font-bold text-white mb-2">Cancel Request?</h2>
            <p class="text-zinc-500 mb-8 text-sm">
              Do you want to cancel your friend request to <span class="text-zinc-200 font-medium">{{ profile?.username }}</span>?
            </p>
            <div class="flex gap-3 mt-2">
              <button @click="showCancelRequestModal = false" class="flex-1 px-5 py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                Go Back
              </button>
              <button @click="executeCancelRequest" class="flex-1 px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer whitespace-nowrap">
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
import { ChevronLeft, User, Flame, X as XIcon, ChevronRight, Check, Minus, UserPlus, CheckSquare, Share2, UserMinus, Star } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, getDaysInMonth, parseISO, startOfWeek } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';
import { useSocial } from '~/composables/useSocial';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const friendId = route.params.id as string;

const { friendships, refresh: refreshSocial, toggleFavorite } = useSocial();
const { user } = useAuth();

const friendship = computed(() => {
  return friendships.value.find(f => f.participants.includes(friendId));
});

const isFavorite = computed(() => {
  if (!user.value || !friendship.value) return false;
  const myId = String(user.value.id);
  return String(friendship.value.initiatorId) === myId 
    ? friendship.value.initiatorFavorite 
    : friendship.value.receiverFavorite;
});

const handleToggleFavorite = async () => {
  if (!friendship.value) return;
  await toggleFavorite(friendship.value.id, !isFavorite.value);
};

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
const isProcessing = ref(false);

const openShareModal = async () => {
  const { data: habitsData } = await $fetch<{ data: any[] }>('/api/habits');
  myHabits.value = habitsData;
  // Pre-select habits already shared with this friend
  selectedHabitIds.value = habitsData
    .filter((h: any) => h.sharedWith?.includes(friendId))
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
  isProcessing.value = true;
  try {
    await $fetch('/api/friendships', { method: 'POST', body: { targetUserId: friendId } });
    await refreshSocial();
    
    const { data: habitsData } = await $fetch<{ data: any[] }>('/api/habits');
    myHabits.value = habitsData;
    selectedHabitIds.value = [];
    
    if (habitsData.length > 0) {
      shareModalTitle.value = 'Request Sent!';
      showShareModal.value = true;
    }
  } catch (err) {
    console.error('Failed to send friend request:', err);
  } finally {
    isProcessing.value = false;
  }
};

const executeAcceptRequest = async () => {
  if (!friendship.value) return;
  isProcessing.value = true;
  try {
    await $fetch(`/api/friendships/${friendship.value.id}`, { method: 'PUT' });
    await refreshSocial();

    const { data: habitsData } = await $fetch<{ data: any[] }>('/api/habits');
    myHabits.value = habitsData;
    selectedHabitIds.value = [];
    
    if (habitsData.length > 0) {
      shareModalTitle.value = 'Request Accepted!';
      showShareModal.value = true;
    }
  } catch (err) {
    console.error('Failed to accept friend request:', err);
  } finally {
    isProcessing.value = false;
  }
};

const executeBatchShareRefresh = async () => {
  showShareModal.value = false;
  load(); // Reload friend data to see if anything changed
};

const executeUnfriend = async () => {
  if (!friendship.value) return;
  await $fetch(`/api/friendships/${friendship.value.id}`, { method: 'DELETE' });
  await refreshSocial();
  showUnfriendModal.value = false;
  navigateTo('/social?tab=friends');
};

const executeCancelRequest = async () => {
  if (!friendship.value) return;
  await $fetch(`/api/friendships/${friendship.value.id}`, { method: 'DELETE' });
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

const isAnyModalOpen = computed(() => showUnfriendModal.value || showCancelRequestModal.value);

useModalHistory(isAnyModalOpen, () => {
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

import { isStreakFaded, getStreakTheme } from '~/utils/ui';
const isFaded = (habit: Habit) => isStreakFaded(habit);

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

const openHabitDetails = (habit: Habit) => {
  selectedHabit.value = habit;
  currentCalendarDate.value = new Date();
  showModal.value = true;
};

const getHabitStatusMap = (habitId: string) => {
  const map: Record<string, string> = {};
  logs.value.filter(l => l.habitId === habitId).forEach(l => {
    map[l.date] = l.status;
  });
  return map;
};

const getStatus = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.find(l => l.habitId === habitId && l.date === dateStr)?.status;
};

const load = async () => {
  loading.value = true;
  try {
    // 1. Fetch profile (always succeeds for public profiles)
    // 2. Fetch shared habits (handles 403 or empty data gracefully)
    // 3. Ensure social state is refreshed to get current relationshipStatus
    const [profileDataResponse, sharedDataResponse] = await Promise.all([
      $fetch<{ data: any }>(`/api/users/${friendId}/profile`),
      $fetch<{ data: any }>('/api/social/friend-data', { query: { friendId } }).catch(err => {
        console.warn('Could not fetch shared habits:', err.message);
        return { data: { habits: [], logs: [] } };
      }),
      refreshSocial(true)
    ]);
    
    profile.value = profileDataResponse.data;
    habits.value = sharedDataResponse.data.habits || [];
    logs.value = sharedDataResponse.data.logs || [];
  } catch (error: any) {
    console.error('Error loading friend profile:', error);
    if (error.statusCode === 400) {
      console.error('Invalid ID format');
    }
  } finally {
    loading.value = false;
  }
};



const isCompleted = (habitId: string, day: Date) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  return logs.value.some(l => l.habitId === habitId && l.date === dateStr && l.status === 'completed');
};

// --- Dynamic Log Fetching ---
const handleFriendMonthChanged = async (newDate: Date) => {
  if (!selectedHabit.value) return;
  const start = format(startOfMonth(newDate), 'yyyy-MM-dd');
  const end = format(endOfMonth(newDate), 'yyyy-MM-dd');
  calendarLoading.value = true;
  try {
    const { data } = await $fetch<{ data: any }>('/api/social/habit-details', { 
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

onMounted(() => {
  load();
});
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
</script>
