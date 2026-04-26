<template>
  <div class="space-y-3">
    <div class="flex items-center gap-1 px-4 sm:px-0" v-motion-slide-visible-once-left>
      <NuxtLink to="/social" class="inline-flex items-center justify-center p-1 -ml-1 text-zinc-500 hover:text-white transition-all flex-shrink-0">
        <ChevronLeft class="w-6 h-6" />
      </NuxtLink>
      <div class="flex items-center justify-between flex-1">
        <div v-if="profile" class="flex items-center gap-4">
          <div class="w-12 h-12 bg-zinc-925 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
            <img v-if="profile.photourl" :src="profile.photourl" alt="" class="w-full h-full object-cover" />
            <User v-else class="w-6 h-6 text-zinc-600" />
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-white">{{ profile.username }}'s habits</h1>
            <p class="text-zinc-400 text-xs">habits shared with you</p>
          </div>
        </div>

        <div v-if="profile && !loading" class="flex items-center gap-2">
          <button v-if="relationshipStatus === 'none'" @click="executeSendRequest" class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl transition-colors font-semibold text-sm cursor-pointer shadow-lg shadow-white/5">
            <UserPlus class="w-4 h-4" /> Add
          </button>
          <button v-else-if="relationshipStatus === 'pending_incoming'" @click="executeAcceptRequest" class="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors font-semibold text-sm cursor-pointer shadow-lg shadow-emerald-500/20">
            <Check class="w-4 h-4" /> Accept
          </button>
          <span v-else-if="relationshipStatus === 'pending_outgoing'" class="text-xs font-semibold text-zinc-500 bg-zinc-925 px-3 py-1.5 rounded-xl border border-zinc-800">
            Pending
          </span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center p-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>

    <!-- Shared Habit List (Single Card) -->
    <div v-if="!loading" v-motion-fade class="bg-zinc-925/80 backdrop-blur-sm sm:rounded-2xl rounded-none shadow-2xl divide-y divide-zinc-800/80 border-y border-x-0 sm:border border-zinc-800/80 overflow-x-auto">
      <div v-if="habits.length === 0" class="p-10 text-center text-zinc-500 italic text-sm">
        {{ profile?.username }} hasn't shared any habits with you yet.
      </div>
      
      <div v-for="habit in habits" :key="habit.id" 
           @click="openHabitDetails(habit)"
           class="p-4 pt-14 sm:pt-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 relative group cursor-pointer hover:bg-zinc-925/50 transition-colors">
        
        <!-- Floating Streak Badge -->
        <div 
          v-if="(streakInfoMap.get(habit.id)?.count ?? 0) >= 2"
          class="absolute top-3 left-0 sm:top-2 flex items-center gap-1.5 px-3 py-1 bg-black border border-l-0 rounded-r-full rounded-l-none z-20 transition-all duration-500"
          :class="[
            streakInfoMap.get(habit.id)?.faded ? 'opacity-30' : 'opacity-100',
            getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).border
          ]"
        >
          <span 
            class="text-[10px] font-black tracking-tight"
            :class="getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).text"
          >
            x{{ streakInfoMap.get(habit.id)?.count }} STREAK
          </span>
          <Flame 
            v-if="(streakInfoMap.get(habit.id)?.count ?? 0) >= 7"
            class="w-3.5 h-3.5" 
            :class="[
              getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).text,
              getStreakTheme(streakInfoMap.get(habit.id)?.count ?? 0).fill
            ]"
          />
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
                <X v-else-if="getStatus(habit.id, day) === 'failed'" class="w-4 h-4 text-white" />
                <Minus v-else-if="getStatus(habit.id, day) === 'skipped'" class="w-4 h-4 text-white" />
              </div>

              <div class="text-[10px] font-bold" :class="isToday(day) ? 'text-white' : 'text-zinc-500'">
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- View Habit Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showModal && selectedHabit" 
          class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 p-0"
          :class="{ 'modal-parent-adaptive': isHeightOverflowing }"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="showModal = false"></div>
          
          <!-- Modal Content -->
          <div 
            ref="modalContent"
            class="relative w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
            :class="{ 'modal-adaptive-height': isHeightOverflowing }"
          >
            <div class="flex items-center gap-1 mb-6 -ml-2">

              <button @click="showModal = false" class="p-2 text-zinc-500 hover:text-white transition-all cursor-pointer flex-shrink-0">
                <ChevronLeft class="w-6 h-6" />
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h2 class="text-xl font-bold text-white truncate leading-none">{{ selectedHabit.title }}</h2>
                  <!-- Streak Badge -->
                  <div 
                    v-if="(streakInfoMap.get(selectedHabit.id)?.count ?? 0) >= 2"
                    class="flex items-center gap-1 px-2 py-0.5 bg-black border rounded-full shrink-0"
                    :class="[
                      streakInfoMap.get(selectedHabit.id)?.faded ? 'opacity-30' : 'opacity-100',
                      getStreakTheme(streakInfoMap.get(selectedHabit.id)?.count ?? 0).border
                    ]"
                  >
                    <span 
                      class="text-[9px] font-black tracking-tight"
                      :class="getStreakTheme(streakInfoMap.get(selectedHabit.id)?.count ?? 0).text"
                    >
                      x{{ streakInfoMap.get(selectedHabit.id)?.count }} STREAK
                    </span>

                    <Flame 
                      v-if="(streakInfoMap.get(selectedHabit.id)?.count ?? 0) >= 7"
                      class="w-2.5 h-2.5" 
                      :class="[
                        getStreakTheme(streakInfoMap.get(selectedHabit.id)?.count ?? 0).text,
                        getStreakTheme(streakInfoMap.get(selectedHabit.id)?.count ?? 0).fill
                      ]"
                    />
                  </div>
                </div>
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <span class="capitalize">{{ selectedHabit.frequencyPeriod }}</span><template v-if="selectedHabit.frequencyPeriod !== 'daily'">, {{ selectedHabit.frequencyCount }} {{ selectedHabit.frequencyCount === 1 ? 'time' : 'times' }}</template>
                </div>
              </div>
            </div>

            
            <p v-if="selectedHabit.description" class="text-zinc-400 text-sm mb-4 italic break-words whitespace-pre-wrap">
              {{ selectedHabit.description }}
            </p>
            <div v-else class="mb-6"></div>

            <!-- Monthly Calendar View -->
            <div class="space-y-4">
              <div class="flex items-center justify-between px-2">
                <h3 class="text-sm font-bold uppercase tracking-widest text-white">
                  {{ format(currentCalendarDate, 'MMMM yyyy') }}
                </h3>
                <div class="flex gap-2">
                  <button type="button" @click="prevMonth" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                    <ChevronLeft class="w-4 h-4" />
                  </button>
                  <button type="button" @click="nextMonth" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                    <ChevronRight class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="bg-black rounded-2xl p-4 border border-zinc-800">
                <div class="grid grid-cols-7 gap-y-4 gap-x-1">
                  <!-- Day Headers -->
                  <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="text-[10px] text-center font-black uppercase tracking-tighter text-zinc-600 mb-1">
                    {{ dayName }}
                  </div>

                  <!-- Calendar Grid -->
                  <div v-for="(day, i) in calendarDays" :key="i" class="flex flex-col items-center gap-1">
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 relative"
                      :class="[
                        (day.getMonth() !== currentCalendarDate.getMonth() || isFutureDay(day)) ? 'opacity-30 border-transparent' : '',
                        getStatus(selectedHabit.id, day) === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' :
                        getStatus(selectedHabit.id, day) === 'failed' ? 'bg-rose-500 border-rose-500 shadow-md shadow-rose-500/20' :
                        getStatus(selectedHabit.id, day) === 'skipped' ? 'bg-zinc-500 border-zinc-500 shadow-none' :
                        'border-dashed border-zinc-800 bg-transparent'
                      ]"
                    >
                      <Check v-if="getStatus(selectedHabit.id, day) === 'completed'" class="w-3 h-3 text-white" />
                      <X v-else-if="getStatus(selectedHabit.id, day) === 'failed'" class="w-3 h-3 text-white" />
                      <span v-else-if="getStatus(selectedHabit.id, day) === 'skipped'" class="w-3 h-0.5 bg-white rounded-full"></span>
                    </div>
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
            
            <div class="mt-5">
              <button
                @click="showModal = false"
                class="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>


      </Transition>
    </Teleport>

    <!-- Share Habits Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showShareModal" 
          class="fixed inset-0 z-[110] flex items-center justify-center sm:p-4 p-0"
          :class="{ 'modal-parent-adaptive': isShareHeightOverflowing }"
        >
          <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="showShareModal = false"></div>
          <div 
            ref="shareModalContent"
            class="relative w-full h-full sm:h-auto sm:max-w-md max-w-none bg-zinc-925 border-x-0 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl p-8 overflow-y-auto transition-all duration-300"
            :class="{ 'modal-adaptive-height': isShareHeightOverflowing }"
          >
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-zinc-925 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check class="w-8 h-8 text-white" />
              </div>
              <h2 class="text-xl font-bold text-white mb-2">{{ shareModalTitle }}</h2>
              <p class="text-zinc-500 text-sm">
                Which habits would you like to share with <span class="text-zinc-200 font-medium">{{ profile?.username }}</span>?
              </p>
            </div>
            
            <!-- Selection Controls -->
            <div class="flex items-center justify-between mb-3 px-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">My habits</label>
              <button 
                @click="toggleSelectAllHabits"
                title="Select/Unselect All"
                class="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <CheckSquare class="w-4 h-4" />
              </button>
            </div>

            <div class="max-h-[320px] overflow-y-auto pr-2 space-y-2 mb-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <div v-for="habit in myHabits" :key="habit.id" 
                @click="toggleHabitSelection(habit.id)"
                class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group"
                :class="selectedHabitIds.includes(habit.id) ? 'bg-white/5 border-white/20' : 'bg-black border-zinc-900 hover:border-zinc-700'"
              >
                <div class="flex-1 text-sm text-zinc-200 font-medium">{{ habit.title }}</div>
                <div class="w-5 h-5 rounded-md border flex items-center justify-center transition-all"
                  :class="selectedHabitIds.includes(habit.id) ? 'bg-white border-white text-black' : 'border-zinc-700 group-hover:border-zinc-500'"
                >
                  <Check v-if="selectedHabitIds.includes(habit.id)" class="w-3 h-3" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <button @click="executeBatchShare" class="w-full px-5 py-3 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl transition-all shadow-lg shadow-white/5 cursor-pointer">
                {{ selectedHabitIds.length > 0 ? `Share ${selectedHabitIds.length} habits` : 'Continue' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, User, Flame, X, ChevronRight, Check, Minus, UserPlus, CheckSquare } from 'lucide-vue-next';
import { format, subDays, isToday, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays } from 'date-fns';
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

const relationshipStatus = computed(() => {
  if (!friendship.value) return 'none';
  if (friendship.value.status === 'accepted') return 'friends';
  if (friendship.value.initiatorId === String(user.value?.id)) return 'pending_outgoing';
  return 'pending_incoming';
});

// Share Modal State
const showShareModal = ref(false);
const myHabits = ref<any[]>([]);
const selectedHabitIds = ref<string[]>([]);
const shareModalTitle = ref('Request Sent!');

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

const executeBatchShare = async () => {
  if (selectedHabitIds.value.length > 0) {
    await $fetch('/api/social/share-habits', { 
      method: 'POST', 
      body: { 
        targetUserId: friendId, 
        habitIds: selectedHabitIds.value 
      } 
    });
  }
  showShareModal.value = false;
  load(); // Reload friend data to see if anything changed
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

useModalHistory(showModal);

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

// Streak Logic
const streakInfoMap = computed(() => {
  const map = new Map<string, { count: number, faded: boolean }>();
  for (const habit of habits.value) {
    const logMap = new Map<string, string>();
    for (const l of logs.value) {
      if (l.habitid === habit.id) {
        logMap.set(l.date, l.status);
      }
    }

    let currentDay = new Date();
    let streakCount = 0;
    let foundAnchor = false;
    let faded = false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    for (let i = 0; i < 365; i++) {
      const dateStr = format(currentDay, 'yyyy-MM-dd');
      const status = logMap.get(dateStr);

      if (!foundAnchor) {
        if (status === 'completed' || status === 'failed' || status === 'skipped') {
          foundAnchor = true;
          if (dateStr !== todayStr) {
            faded = true;
          }
        }
      }

      if (foundAnchor) {
        if (status === 'completed') {
          streakCount++;
        } else if (status === 'skipped') {
          // freeze
        } else {
          break;
        }
      }
      currentDay = subDays(currentDay, 1);
    }
    map.set(habit.id, { count: streakCount, faded });
  }
  return map;
});

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
    console.log('Loading profile for friendId:', friendId);
    const [profileData, sharedData] = await Promise.all([
      $fetch('/api/social/profile', { query: { friendId } }),
      $fetch('/api/social/friend-data', { query: { friendId } })
    ]);
    
    console.log('Profile data received:', profileData);
    console.log('Shared data received:', sharedData);

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

// ── Modal Overflow Logic ─────────────────────────────────────────────────────
const modalContent = ref<HTMLElement | null>(null);
const isHeightOverflowing = ref(false);

const shareModalContent = ref<HTMLElement | null>(null);
const isShareHeightOverflowing = ref(false);

const checkHeightOverflow = () => {
  if (!modalContent.value) return;
  isHeightOverflowing.value = modalContent.value.scrollHeight > (window.innerHeight - 32);
};

const checkShareHeightOverflow = () => {
  if (!shareModalContent.value) return;
  isShareHeightOverflowing.value = shareModalContent.value.scrollHeight > (window.innerHeight - 32);
};

watch(showModal, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    checkHeightOverflow();
    setTimeout(checkHeightOverflow, 350);
  } else {
    isHeightOverflowing.value = false;
  }
});

const { subscribeToFriendHabits } = useRealtime();
let unsubscribeHabits = () => {};

onMounted(() => {
  load();
  unsubscribeHabits = subscribeToFriendHabits(friendId, () => {
    load();
  });
  window.addEventListener('resize', () => {
    checkHeightOverflow();
    checkShareHeightOverflow();
  });
});

onUnmounted(() => {
  unsubscribeHabits();
  window.removeEventListener('resize', checkHeightOverflow);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('overflow-hidden');
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Scroll Lock ──────────────────────────────────────────────────────────────
watch(
  () => showModal.value || showShareModal.value,
  (isOpen) => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }
);
// ─────────────────────────────────────────────────────────────────────────────
</script>
