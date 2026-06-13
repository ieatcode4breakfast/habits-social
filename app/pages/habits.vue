<template>
  <div key="habits-page-root" class="relative">
    <!-- Sticky Header + Date Row -->
    <div class="sticky top-0 md:top-[57px] z-40 bg-surface-inset">
    <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-surface-inset pt-2 pb-2 sm:pt-4">
      <div class="flex items-center gap-4">
        <UserAvatar 
          v-if="user"
          :src="user.photoUrl" 
          container-class="w-10 h-10 bg-surface-raised rounded-xl shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
          icon-class="w-6 h-6 text-fg-subtle"
          @click="openProfileModal"
        />
        <div>
          <h1 class="text-base font-bold tracking-tight text-fg">My Habits</h1>
          <p class="text-fg-muted text-xs">{{ habits.length }} habit{{ habits.length === 1 ? '' : 's' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="replayTutorial"
          class="w-11 py-2.5 bg-surface-hover hover:bg-surface-hover text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center active:scale-95 border border-border-strong/60"
          title="Help on this page"
          aria-label="Help on this page"
        >
          <CircleHelp class="w-4 h-4" />
        </button>
        <button
          v-if="habits.length > 1"
          @click="showReorderModal = true"
          class="w-11 sm:w-28 py-2.5 bg-surface-hover hover:bg-surface-hover text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95 border border-border-strong/60"
          title="Reorder"
        >
          <ArrowUpDown class="w-4 h-4" />
          <span class="hidden sm:inline">Reorder</span>
        </button>
        <button 
          @click="openAddModal" 
          class="w-11 sm:w-28 py-2.5 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
          title="Add Habit"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
    <!-- Date Header -->
    <div class="bg-date-header-bg border-b sm:border-t border-x-0 sm:border-x border-border-muted/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block sm:pr-2"></div>
        <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
          <div class="flex items-end w-full">
            <div v-for="(day, i) in days" :key="i" class="flex-1 flex flex-col items-center relative">
              <!-- Sunday Divider -->
              <div 
                v-if="i > 0 && day.getDay() === 0" 
                class="absolute left-0 top-0 bottom-0 w-px bg-surface-hover/80"
              ></div>
              <div 
                class="text-[10px] uppercase tracking-tighter font-black transition-colors"
                :class="isSameDay(day, today) ? 'text-fg' : 'text-fg-subtle'"
              >
                {{ format(day, 'EEE') }}
              </div>
              <div 
                class="text-[10px] sm:text-xs font-bold transition-colors"
                :class="isSameDay(day, today) ? 'text-fg' : 'text-fg-subtle'"
              >
                {{ format(day, 'd') }}
              </div>
            </div>
          </div>
        </div>
        <div class="hidden sm:block w-7 shrink-0"></div>
    </div>
    </div>

    <!-- Offline Banner -->
    <div v-if="!isOnlineMounted" class="mx-4 sm:mx-0 my-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-amber-500 text-xs font-semibold">
      <WifiOff class="w-4 h-4 shrink-0" />
      <span>Offline. Changes are saved on this device and will sync when you're back online.</span>
    </div>

    <!-- Habit List (Single Card) -->
    <div v-motion-fade :style="pullStyle" 
         class="habits-content-surface sm:rounded-b-2xl rounded-none overflow-hidden border-b border-x-0 sm:border-x sm:border-b relative will-change-transform transition-colors duration-300"
         :class="!loading ? 'backdrop-blur-md bg-surface-raised/80 border-border-muted/80' : 'border-transparent'">

      <div class="w-full relative">
        <div v-if="loading" class="flex justify-center items-center p-12 min-h-[150px] w-full">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
        </div>
        <div v-else-if="habits.length === 0" class="flex justify-center items-center p-10 text-center text-fg-subtle italic text-sm w-full min-h-[150px]">
          No habits yet. Add one above!
        </div>
      
        <div v-else ref="sortableContainer" class="divide-y divide-border-muted/80 w-full">
          <div 
            v-for="habit in habits" :key="habit.id"
            :data-habit-id="habit.id"
            @click="openEditModal(habit)"
            class="relative py-3 group transition-colors flex flex-col items-stretch sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between gap-x-4 gap-y-2 cursor-pointer hover:bg-surface-hover/40 sm:px-4 bg-surface-raised/80 sortable-item"
          >
        <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-1 sm:pr-2">
          <div class="flex justify-between items-start gap-4">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-fg leading-tight break-all group-hover:text-fg transition-colors">
                {{ habit.title }}
                <!-- Compact Streak Badge -->
                <span 
                  v-if="(habit.currentStreak ?? 0) >= 2"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-inset border rounded-md shrink-0 align-middle ml-1.5"
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
                </span>
              </h3>
            </div>
            
            <div class="shrink-0 flex items-start justify-end sm:hidden">
              <button
                @click.stop="chatAboutHabit(habit)"
                class="text-fg-subtle hover:text-fg transition-all active:scale-95 cursor-pointer opacity-70 group-hover:opacity-100 p-1 -mr-1 -mt-1"
                title="Chat about this habit"
              >
                <MessageCircle class="w-5 h-5" />
              </button>
            </div>
          </div>
          <!-- Frequency Text -->
          <div class="text-[10px] font-semibold tracking-tight text-fg-subtle mt-0.5">
            {{ getFrequencyText(habit) }}
          </div>
        </div>
        
        <!-- Interactive Logs -->
        <TimelineRow
          interactive
          :days="days"
          :reference-date="today"
          :status-map="getHabitStatusMap(habit.id)"
          @click-day="(day, event) => openLogMenu(habit, day, event)"
        />

        <div class="hidden sm:flex w-7 shrink-0 items-center justify-center">
          <button
            @click.stop="chatAboutHabit(habit)"
            class="text-fg-subtle hover:text-fg transition-all active:scale-95 cursor-pointer opacity-70 group-hover:opacity-100 p-1"
            title="Chat about this habit"
          >
            <MessageCircle class="w-5 h-5" />
          </button>
        </div>

          </div>
        </div>
      </div>
    </div>


    <!-- Add Habit Modal -->
    <HabitAddModal
      v-model="showModal"
      :friends="friends"
      :saving="isAddingHabit"
      @save="handleHabitAdd"
    />

    <MyHabitsTutorialDemo
      v-if="showTutorialDemo"
      :log-menu-status="tutorialLogMenuStatus"
      :show-help-center-menu="tutorialShowHelpCenterMenu"
    />

    <HabitAddModal
      v-model="showTutorialAddModal"
      :friends="tutorialFriends"
      :saving="false"
      :tutorial-readonly="true"
      :initial-values="tutorialPrefill"
      @save="handleTutorialSave"
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

    <!-- Reply to Habit Friend Select Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="showHabitReplyFriendSelectModal"
            class="fixed inset-0 z-[150] flex items-center justify-center p-4"
          >
            <div class="fixed inset-0 bg-black/80 backdrop-blur-sm touch-none" @click="showHabitReplyFriendSelectModal = false"></div>

            <div class="relative w-full max-w-sm bg-surface-raised border border-border-muted rounded-2xl flex flex-col max-h-[80vh] overflow-hidden select-none">
              <div class="p-4 border-b border-border-muted/60 flex items-center justify-between">
                <h3 class="text-sm font-bold text-fg">Chat about this habit with</h3>
                <button
                  @click="showHabitReplyFriendSelectModal = false"
                  class="p-1 hover:bg-surface-hover rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer"
                >
                  <XIcon class="w-4 h-4" />
                </button>
              </div>

              <div class="px-3 pt-2 pb-1">
                <input
                  v-model="replyFriendSearchQuery"
                  type="text"
                  placeholder="Filter friends..."
                  class="w-full bg-surface-solid border border-border-muted text-fg text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-border-strong transition-colors"
                />
              </div>

              <div class="flex-1 overflow-y-auto p-2 space-y-1">
                <div v-if="acceptedFriends.length === 0" class="py-12 text-center text-fg-subtle italic text-sm">
                  You don't have any friends yet. Go to the
                  <button type="button" @click="goToFriendsSection" class="text-fg hover:text-fg underline underline-offset-2 transition-colors cursor-pointer">
                    Friends
                  </button>
                  section to add them.
                </div>
                <div v-else-if="filteredReplyFriends.length === 0" class="py-12 text-center text-fg-subtle italic text-sm">
                  No friends found matching your filter.
                </div>

                <button
                  v-for="friend in filteredReplyFriends"
                  :key="friend.id"
                  @click="selectFriendForHabitReply(friend)"
                  :disabled="replyFriendActionId === friend.id"
                  class="w-full text-left p-3 rounded-xl hover:bg-surface-solid/60 transition-colors flex items-center gap-3 cursor-pointer outline-none border border-transparent disabled:opacity-60 disabled:cursor-wait"
                >
                  <UserAvatar
                    :src="friend.photoUrl"
                    container-class="w-9 h-9 bg-surface-solid"
                    icon-class="w-5 h-5 text-fg-subtle"
                  />

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <div class="text-sm font-bold text-fg truncate">{{ friend.username || 'Unknown' }}</div>
                      <Star v-if="isFriendFavorite(friend)" class="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      <div v-if="replyFriendActionId === friend.id" class="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin shrink-0"></div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Share Before Habit Reply Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="showShareBeforeReplyModal" class="fixed inset-0 z-[160] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/80 backdrop-blur-md touch-none" @click="closeShareBeforeReplyModal"></div>
            <div class="relative w-full max-w-sm bg-surface-raised border border-border-muted rounded-3xl p-8 text-center">
              <div class="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus class="w-8 h-8 text-fg" />
              </div>
              <h2 class="text-xl font-bold text-fg mb-2">Share habit with {{ pendingShareFriendName }}?</h2>
              <p class="text-fg-subtle mb-8 text-sm">
                This habit is not currently shared with <span class="text-fg font-medium">{{ pendingShareFriendName }}</span>.
              </p>
              <div class="flex gap-3 mt-2">
                <button
                  @click="closeShareBeforeReplyModal"
                  :disabled="shareReplyLoading"
                  class="flex-1 px-5 py-3 bg-transparent hover:bg-surface-hover text-fg-muted hover:text-fg font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  @click="executeShareBeforeHabitReply"
                  :disabled="shareReplyLoading"
                  class="flex-1 px-5 py-3 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <template v-if="shareReplyLoading">
                    <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    Sharing...
                  </template>
                  <template v-else>
                    Share
                  </template>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2, Check, X as XIcon, Minus, ChevronLeft, ChevronRight, User, ChevronUp, ChevronDown, Edit2, Save, CheckSquare, GripVertical, ArrowUpDown, Flame, Palmtree, MessageCircle, UserPlus, Star, WifiOff, CircleHelp } from 'lucide-vue-next';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isAfter, startOfDay, addDays, isSameWeek, isSameMonth, parseISO, startOfWeek, isSameDay } from 'date-fns';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';
import type { HabitAddPayload } from '~/components/HabitAddModal.vue';
import { getStreakTheme, isStreakFaded as isFaded, autoExpandTextarea as autoExpand, isMarkable } from '~/utils/ui';
import { useSortable } from '@vueuse/integrations/useSortable';
import { useCalendar } from '~/composables/useCalendar';
import type { DriveStep, Driver, PopoverDOM } from 'driver.js';
import { isTutorialCompleted, setTutorialCompleted } from '~/utils/tutorialFlags';
import {
  MY_HABITS_TUTORIAL_FRIENDS,
  MY_HABITS_TUTORIAL_PRIMARY_HABIT,
  MY_HABITS_TUTORIAL_STATUS_STEPS,
  MY_HABITS_TUTORIAL_STEP_COPY,
  MY_HABITS_TUTORIAL_STREAK_HELP_PATH,
  getMyHabitsTutorialLayout,
  type MyHabitsTutorialStatusKey,
} from '~/utils/myHabitsTutorialDemo';

type EditableLogStatus = Exclude<HabitLog['status'], 'cleared'>;
type LogMenuStatus = EditableLogStatus | null;
type LogMenuOpenOptions = {
  skipsPeriod?: Habit['skipsPeriod'];
  skipsCount?: number;
};

definePageMeta({ middleware: 'auth' });
import { useSocial, type UserProfile } from '../composables/useSocial';

type ReplyFriend = UserProfile & { isFavorite?: boolean };
type HabitReplyStatus = Exclude<HabitLog['status'], 'cleared'>;
type HabitReplyWeeklyStatus = {
  date: string;
  status?: HabitReplyStatus;
};
type HabitReplyCard = {
  id: string;
  type: 'HABIT_REPLY';
  user: {
    id: string;
    name: string;
    photoUrl: string | null;
  };
  habit: {
    id: string;
    title: string;
  };
  message: string;
  date: string;
  timestamp: Date;
  weeklyStatus: HabitReplyWeeklyStatus[];
  streakCount?: number;
  streakAnchorDate?: string | null;
  frequencyText: string;
};

const api = useHabitsApi();
const { user } = useAuth();
const { lastSyncTime } = api;
const route = useRoute();
const router = useRouter();

const isMounted = ref(false);

const { pullDistance, isPulling, isRefreshing } = usePullToRefresh(async () => {
  await load();
});

const pullStyle = computed(() => {
  const useTransition = isMounted.value && !isPulling.value && !loading.value && !isRefreshing.value;
  return {
    transform: 'translateY(var(--pull-distance, 0px))',
    transition: useTransition ? 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
  };
});

const { friends: rawFriends, refresh: refreshSocial, init: initSocial, cleanup: cleanupSocial } = useSocial();
const showProfileModal = useState('showProfileModal', () => false);
const { isOnline } = useNetwork();
const isOnlineMounted = ref(true);

watch(isOnline, (val) => {
  isOnlineMounted.value = val;
});

const openProfileModal = () => {
  if (!isOnline.value) {
    showToast('You are offline. Profile changes require a connection.', 'failed');
    return;
  }
  showProfileModal.value = true;
};

const friends = computed<ReplyFriend[]>(() => {
  const list = [...(rawFriends.value || [])] as ReplyFriend[];
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

let lastLoadSequence = 0;
const habits = ref<Habit[]>([]);
const logs = ref<HabitLog[]>([]);
const loading = ref(true);

const showModal = ref(false);
const showReorderModal = ref(false);
const showEditModal = ref(false);
const editingHabit = ref<Habit | null>(null);
const editSkipsPeriod = ref<Habit['skipsPeriod'] | undefined>(undefined);
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
const showHabitReplyFriendSelectModal = ref(false);
const showShareBeforeReplyModal = ref(false);
const pendingReplyHabit = ref<Habit | null>(null);
const pendingShareFriend = ref<ReplyFriend | null>(null);
const replyFriendSearchQuery = ref('');
const replyFriendActionId = ref<string | null>(null);
const shareReplyLoading = ref(false);

// --- Tutorial State ---
const isTutorialActive = ref(false);
const showTutorialDemo = ref(false);
const showTutorialAddModal = ref(false);
const tutorialLogMenuStatus = ref<MyHabitsTutorialStatusKey | null>(null);
const tutorialShowHelpCenterMenu = ref(false);
const tutorialFriends = MY_HABITS_TUTORIAL_FRIENDS;
const tutorialPrefill = computed(() => MY_HABITS_TUTORIAL_PRIMARY_HABIT);

const handleTutorialSave = () => {};

let tutorialDriver: Driver | null = null;
let tutorialStarting = false;
let tutorialCompleted = false;
let tutorialDestroyingForCleanup = false;

const signupAvatarOpen = useState<boolean>('signup-avatar-modal-open', () => false);
const helpModalOpen = useState<boolean>('help-modal-open', () => false);

const isTutorialBlocked = computed(() => {
  return (
    showModal.value ||
    showEditModal.value ||
    showReorderModal.value ||
    showHabitReplyFriendSelectModal.value ||
    showShareBeforeReplyModal.value ||
    showProfileModal.value ||
    helpModalOpen.value ||
    activeLogMenu.value !== null ||
    loading.value ||
    isAddingHabit.value
  );
});

const sortableContainer = ref<HTMLElement | null>(null);

useSortable(sortableContainer, habits, {
  watchElement: true,
  draggable: '.sortable-item',
  animation: 250,
  delay: 200,
  delayOnTouchOnly: false,
  touchStartThreshold: 5,
  fallbackTolerance: 6,
  ghostClass: 'opacity-0',
  dragClass: 'scale-[1.02]',
  forceFallback: true,
  fallbackClass: 'sortable-fallback-opaque',
  fallbackOnBody: true,
  onEnd: async () => {
    await nextTick();
    api.reorderHabits(habits.value.map(h => h.id)).catch(err => {
      console.error('[My Habits] Failed to save reorder:', err);
      showToast('Failed to save order', 'failed');
    });
  }
});

const onHabitsReordered = (newOrderIds: string[]) => {
  const newHabits = [];
  for (const id of newOrderIds) {
    const habit = habits.value.find(h => h.id === id);
    if (habit) newHabits.push(habit);
  }
  habits.value = newHabits;
  api.reorderHabits(newOrderIds);
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

const { today } = useStableToday();
const isFutureDay = (day: Date) => isAfter(startOfDay(day), startOfDay(today.value));
const days = computed(() => Array.from({ length: 7 }, (_, i) => subDays(today.value, 6 - i)));
const startDate = computed(() => format(startOfMonth(subMonths(today.value, 1)), 'yyyy-MM-dd'));
const endDate = computed(() => format(endOfMonth(addMonths(today.value, 1)), 'yyyy-MM-dd'));

// Logic moved to utils/ui

const getFrequencyText = (habit: Habit) => {
  const period = habit.skipsPeriod;
  const maxSkips = habit.skipsCount ?? 0;
  const now = today.value;

  if (period === 'disabled' || ((period === 'weekly' || period === 'monthly') && maxSkips === 0)) {
    return 'No skips allowed';
  }

  if (period === 'none') return 'Unlimited skips';

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

  const remainingSkips = Math.max(0, maxSkips - skipped);
  const skipText = remainingSkips === 1 ? '1 skip remaining' : `${remainingSkips} skips remaining`;
  
  return `${skipText} this ${period === 'weekly' ? 'week' : 'month'}`;
};

const load = async (silent = false) => {
  const currentSequence = ++lastLoadSequence;
  if (!silent) loading.value = true;
  try {
    const habitPromise = api.getHabits();
    const logsPromise = api.getLogs(startDate.value, endDate.value);
    const sideEffects: Promise<unknown>[] = [];
    if (isOnline.value) {
      sideEffects.push(refreshSocial());
    }
    if (!silent) {
      sideEffects.push(new Promise<void>(resolve => setTimeout(resolve, 500)));
    }
    const sideEffectsPromise = Promise.all(sideEffects);
    const [h, l] = await Promise.all([habitPromise, logsPromise]);
    await sideEffectsPromise;

    if (currentSequence !== lastLoadSequence) return;

    habits.value = h;
    logs.value = l;

  } catch (error) {
    console.error('[My Habits] load() failed:', error);
  } finally {
    if (currentSequence === lastLoadSequence) {
      loading.value = false;
    }
  }
};



const getHabitStatusMap = (habitId: string) => {
  const map: Record<string, string> = {};
  logs.value.filter(l => l.habitId === habitId).forEach(l => {
    map[l.date] = l.status;
  });
  return map;
};

const acceptedFriends = computed(() => friends.value);

const isFriendFavorite = (friend: ReplyFriend) => friend.isFavorite === true;

const filteredReplyFriends = computed(() => {
  let list = acceptedFriends.value;

  if (replyFriendSearchQuery.value.trim()) {
    const q = replyFriendSearchQuery.value.toLowerCase().trim();
    list = list.filter(friend => (friend.username || '').toLowerCase().includes(q));
  }

  return [...list].sort((a, b) => {
    const aFav = isFriendFavorite(a);
    const bFav = isFriendFavorite(b);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return (a.username || '').localeCompare(b.username || '');
  });
});

const pendingShareFriendName = computed(() => pendingShareFriend.value?.username || 'Unknown');

const buildHabitReplyCard = (habit: Habit): HabitReplyCard | null => {
  if (!user.value?.id) return null;

  const weeklyStatus = days.value.map((day) => {
    const date = format(day, 'yyyy-MM-dd');
    const log = logs.value.find(l => l.habitId === habit.id && l.date === date);
    const status = log?.status === 'cleared' ? undefined : log?.status;
    return { date, status };
  });

  const latestDate = weeklyStatus[weeklyStatus.length - 1]?.date;
  if (!latestDate) return null;

  const latestDateLabel = format(parseISO(latestDate), 'MMMM d, yyyy');
  return {
    id: `habit-reply-${habit.id}-${latestDate}`,
    type: 'HABIT_REPLY',
    user: {
      id: String(user.value.id),
      name: user.value.username,
      photoUrl: user.value.photoUrl || null
    },
    habit: {
      id: habit.id,
      title: habit.title
    },
    message: `as of ${latestDateLabel}.`,
    date: latestDate,
    timestamp: new Date(),
    weeklyStatus,
    streakCount: habit.currentStreak,
    streakAnchorDate: habit.streakAnchorDate,
    frequencyText: getFrequencyText(habit)
  };
};

const navigateToHabitReplyFriend = (friendId: string) => {
  if (!isOnline.value) {
    showToast('This action needs an internet connection.', 'failed');
    return;
  }
  const card = pendingReplyHabit.value ? buildHabitReplyCard(pendingReplyHabit.value) : null;
  if (!card) {
    showToast('Could not prepare habit reply. Try again.', 'failed');
    return;
  }

  const replyContext = useState<HabitReplyCard | null>('chat-reply-activity-context');
  replyContext.value = { ...card };
  showHabitReplyFriendSelectModal.value = false;
  setTimeout(() => {
    navigateTo(`/inbox?replyToFriend=${friendId}`);
  }, 50);
};

const chatAboutHabit = (habit: Habit) => {
  if (!isOnline.value) {
    showToast('This action needs an internet connection.', 'failed');
    return;
  }
  pendingReplyHabit.value = habit;
  showHabitReplyFriendSelectModal.value = true;
};

const selectFriendForHabitReply = async (friend: ReplyFriend) => {
  const habit = pendingReplyHabit.value;
  if (!habit) return;

  replyFriendActionId.value = friend.id;
  try {
    const sharedWith = (habit.sharedWith ?? []).map(String);
    if (sharedWith.includes(friend.id)) {
      navigateToHabitReplyFriend(friend.id);
      return;
    }

    pendingShareFriend.value = friend;
    showShareBeforeReplyModal.value = true;
  } finally {
    replyFriendActionId.value = null;
  }
};

const closeShareBeforeReplyModal = () => {
  if (shareReplyLoading.value) return false;
  showShareBeforeReplyModal.value = false;
  pendingShareFriend.value = null;
  return true;
};

const goToFriendsSection = async () => {
  if (!isOnline.value) {
    showToast('This action needs an internet connection.', 'failed');
    return;
  }
  modalHistory.suppressNextHistoryBack();
  showHabitReplyFriendSelectModal.value = false;
  await navigateTo({ path: '/social', query: { tab: 'friends' } }, { replace: true });
};

const executeShareBeforeHabitReply = async () => {
  if (!isOnline.value) {
    showToast('This action needs an internet connection.', 'failed');
    return;
  }
  const habit = pendingReplyHabit.value;
  const friend = pendingShareFriend.value;
  if (!habit || !friend) return;

  shareReplyLoading.value = true;
  try {
    await $fetch<{ data: { success: boolean; alreadyShared: boolean } }>('/api/social/share-habit', {
      method: 'POST',
      body: {
        targetUserId: friend.id,
        habitId: habit.id,
        userDate: format(new Date(), 'yyyy-MM-dd')
      }
    });

    const nextSharedWith = Array.from(new Set([...(habit.sharedWith ?? []).map(String), friend.id]));
    pendingReplyHabit.value = { ...habit, sharedWith: nextSharedWith };
    const idx = habits.value.findIndex(h => h.id === habit.id);
    const existingHabit = idx >= 0 ? habits.value[idx] : undefined;
    if (existingHabit) {
      habits.value[idx] = { ...existingHabit, sharedWith: nextSharedWith };
    }

    showShareBeforeReplyModal.value = false;
    pendingShareFriend.value = null;
    navigateToHabitReplyFriend(friend.id);
  } catch (error) {
    console.error('Failed to share habit before reply:', error);
    showToast('Could not share this habit. Try again.', 'failed');
  } finally {
    shareReplyLoading.value = false;
  }
};

const activeLogMenu = ref<{ habitId: string, date: Date } | null>(null);
const referenceRef = ref<HTMLElement | null>(null);

const activeHabitForMenu = computed(() => {
  if (!activeLogMenu.value) return null;
  return habits.value.find(h => h.id === activeLogMenu.value?.habitId) || (editingHabit.value?.id === activeLogMenu.value?.habitId ? editingHabit.value : null);
});
const openLogMenu = (habit: Habit, day: Date, event: MouseEvent, options?: LogMenuOpenOptions) => {
  if (!isMarkable(day, today.value)) {
    showToast('You can only update habits for the last 7 days', 'failed');
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
  referenceRef.value = null;
};


const setLogStatus = async (habit: Habit, day: Date, nextStatus: LogMenuStatus) => {
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
  referenceRef.value = null;

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

const handleHabitAdd = async (data: HabitAddPayload) => {
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
  showModal.value || showReorderModal.value || showHabitReplyFriendSelectModal.value || showShareBeforeReplyModal.value
);

const modalHistory = useModalHistory(isAnyModalOpen, () => {
  showModal.value = false;
  showReorderModal.value = false;
  showHabitReplyFriendSelectModal.value = false;
  closeShareBeforeReplyModal();
});

watch(showHabitReplyFriendSelectModal, (val) => {
  if (!val) {
    replyFriendSearchQuery.value = '';
    pendingReplyHabit.value = null;
    pendingShareFriend.value = null;
    showShareBeforeReplyModal.value = false;
  }
});

// Social integration is now handled by useSocial

// --- Tutorial Orchestration ---

const coachSelector = (target: string) => `[data-coach-target="${target}"]`;

const getCoachElement = (target: string): Element => {
  const element = document.querySelector(coachSelector(target));
  if (!element) {
    throw new Error(`Missing tutorial coach target: ${target}`);
  }
  return element;
};

/**
 * Returns the coach element without throwing — used for status-menu
 * steps where the target exists inside a floating component that may
 * not have settled into its final DOM position when the driver first
 * evaluates the element function.  Returns null instead of throwing so
 * driver.js falls back to its dummy-element path instead of corrupting
 * its internal state.
 */
const tryGetCoachElement = (target: string): Element | null =>
  document.querySelector(coachSelector(target));

/**
 * Returns the correct Help Center coach target for the current viewport
 * by checking which element is actually visible in the DOM rather than
 * relying on the cached layout calculated at tutorial start.  The fake
 * desktop nav uses 'md:block' (≥768px) and the mobile menu uses
 * 'lg:hidden' (<1024px).  We resolve the first visible match.
 */


const waitForCoachElement = async (target: string, timeoutMs = 2000): Promise<Element | null> => {
  const selector = coachSelector(target);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }

  return document.querySelector(selector);
};

const labelSkipAllButton = (popover: PopoverDOM) => {
  popover.closeButton.textContent = 'Skip all';
  popover.closeButton.setAttribute('aria-label', 'Skip all');
  popover.closeButton.classList.add('driver-popover-skip-all-btn');
  popover.progress.insertAdjacentElement('afterend', popover.closeButton);

  const streakHelpLink = popover.description.querySelector<HTMLAnchorElement>(`a[href="${MY_HABITS_TUTORIAL_STREAK_HELP_PATH}"]`);
  streakHelpLink?.addEventListener('click', () => {
    completeTutorial();
  });
};

const completeTutorial = () => {
  if (tutorialCompleted) return;
  tutorialCompleted = true;
  showTutorialAddModal.value = false;
  showTutorialDemo.value = false;
  tutorialLogMenuStatus.value = null;
  tutorialShowHelpCenterMenu.value = false;
  isTutorialActive.value = false;
  if (user.value?.id) {
    setTutorialCompleted(user.value.id);
  }
  if (tutorialDriver) {
    const d = tutorialDriver;
    tutorialDriver = null;
    d.destroy();
  }
};

const cleanupTutorial = () => {
  const d = tutorialDriver;
  tutorialDriver = null;
  tutorialDestroyingForCleanup = true;
  showTutorialAddModal.value = false;
  showTutorialDemo.value = false;
  tutorialLogMenuStatus.value = null;
  tutorialShowHelpCenterMenu.value = false;
  isTutorialActive.value = false;
  if (d?.isActive()) d.destroy();
  tutorialDestroyingForCleanup = false;
};

const startTutorial = async (options: { force?: boolean } = {}) => {
  if (!import.meta.client) return;
  if (tutorialStarting) return;
  if (tutorialDriver) return;
  if (route.path !== '/habits') return;
  if (signupAvatarOpen.value) return;
  if (isTutorialBlocked.value) return;
  if (!user.value?.id || (!options.force && isTutorialCompleted(user.value.id))) return;

  tutorialStarting = true;
  showTutorialDemo.value = true;
  await nextTick();
  const addTarget = await waitForCoachElement('my-habits-demo-add');
  if (!addTarget || route.path !== '/habits' || signupAvatarOpen.value || isTutorialBlocked.value || !user.value?.id || (!options.force && isTutorialCompleted(user.value.id))) {
    showTutorialDemo.value = false;
    tutorialStarting = false;
    return;
  }

  const { driver } = await import('driver.js');

  tutorialCompleted = false;
  const getTutorialLayout = () => getMyHabitsTutorialLayout(window.innerWidth);
  const addStepIndex = 0;
  const saveStepIndex = 5;
  const statusIntroStepIndex = 7;


  const advanceFromAddStep = async (d: Driver) => {
    showTutorialAddModal.value = true;
    isTutorialActive.value = true;
    await nextTick();
    const titleTarget = await waitForCoachElement('my-habits-add-title');
    if (!titleTarget) {
      completeTutorial();
      return;
    }
    d.moveNext();
  };

  const advanceFromSaveStep = async (d: Driver) => {
    showTutorialAddModal.value = false;
    isTutorialActive.value = false;
    await nextTick();
    const addedHabitTarget = await waitForCoachElement(getTutorialLayout().habitAdded.target);
    if (!addedHabitTarget) {
      completeTutorial();
      return;
    }
    d.moveNext();
  };

  const advanceFromStatusIntroStep = async (d: Driver) => {
    tutorialLogMenuStatus.value = 'completed';
    await nextTick();
    const firstStatusStep = MY_HABITS_TUTORIAL_STATUS_STEPS[0];
    if (!firstStatusStep) {
      completeTutorial();
      return;
    }
    const firstStatusTarget = await waitForCoachElement(firstStatusStep.coachTarget);
    if (!firstStatusTarget) {
      completeTutorial();
      return;
    }
    d.moveNext();
  };

  const movePreviousWithStatusMenu = async (d: Driver, status: MyHabitsTutorialStatusKey) => {
    showTutorialAddModal.value = false;
    isTutorialActive.value = false;
    tutorialShowHelpCenterMenu.value = false;
    tutorialLogMenuStatus.value = status;
    await nextTick();
    const target = MY_HABITS_TUTORIAL_STATUS_STEPS.find(step => step.status === status)?.coachTarget;
    if (!target) {
      d.movePrevious();
      return;
    }
    const statusTarget = await waitForCoachElement(target);
    if (!statusTarget) {
      completeTutorial();
      return;
    }
    d.movePrevious();
  };



  const advanceTutorialFromOverlay = async (d: Driver) => {
    if (d.isLastStep()) return;

    const activeIndex = d.getActiveIndex();
    if (activeIndex === addStepIndex) {
      await advanceFromAddStep(d);
      return;
    }
    if (activeIndex === saveStepIndex) {
      await advanceFromSaveStep(d);
      return;
    }
    if (activeIndex === statusIntroStepIndex) {
      await advanceFromStatusIntroStep(d);
      return;
    }


    d.moveNext();
  };

  const statusCoachSteps: DriveStep[] = MY_HABITS_TUTORIAL_STATUS_STEPS.map((statusStep, index) => {
    const isLastStatusStep = index === MY_HABITS_TUTORIAL_STATUS_STEPS.length - 1;
    const nextStatusStep = isLastStatusStep ? null : MY_HABITS_TUTORIAL_STATUS_STEPS[index + 1]!;

    return {
      element: () => tryGetCoachElement(statusStep.coachTarget) as Element,
      popover: {
        description: statusStep.stepDescription,
        side: getTutorialLayout().statusMenu[statusStep.status].side,
        align: getTutorialLayout().statusMenu[statusStep.status].align,
        popoverClass: 'my-habits-tutorial-status-popover',
        showButtons: ['next', 'previous', 'close'],
        // Pre-load the NEXT status so its coach target is guaranteed to
        // exist in the DOM before driver.js calls the element function
        // inside G() -> xe().  Without this, a synchronous gap between
        // state update and Vue DOM flush causes the element function to
        // return null, driver.js falls back to a zero-size dummy at the
        // viewport center, and d.refresh() cannot recover it.
        ...(nextStatusStep
          ? {
              onNextClick: async (_el, _step, { driver: d }) => {
                tutorialLogMenuStatus.value = nextStatusStep.status;
                await nextTick();
                const ready = await waitForCoachElement(nextStatusStep.coachTarget);
                if (!ready) {
                  completeTutorial();
                  return;
                }
                d.moveNext();
              },
            }
          : {}),
        ...(index > 0
          ? {
              onPrevClick: async (_el, _step, { driver: d }) => {
                const previousStatus = MY_HABITS_TUTORIAL_STATUS_STEPS[index - 1]?.status;
                if (!previousStatus) {
                  d.movePrevious();
                  return;
                }
                await movePreviousWithStatusMenu(d, previousStatus);
              },
            }
          : {}),
      },
      onHighlightStarted: (_el, _step, { driver: d }) => {
        showTutorialAddModal.value = false;
        isTutorialActive.value = false;
        tutorialLogMenuStatus.value = statusStep.status;
        tutorialShowHelpCenterMenu.value = false;
        // Always do a deferred refresh: even when the element was found,
        // the LogMenu's @floating-ui/vue position may not have settled.
        // The onNextClick pre-load handles forward-navigation DOM timing;
        // this catches backward navigation and floating-position races.
        void nextTick().then(() => { setTimeout(() => d.refresh(), 50); });
      },
    };
  });

  tutorialDriver = driver({
    animate: true,
    overlayOpacity: 0.5,
    allowClose: true,
    disableActiveInteraction: true,
    overlayClickBehavior: (_, __, { driver: d }) => {
      void advanceTutorialFromOverlay(d);
    },
    doneBtnText: 'Finish',
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    onPopoverRender: labelSkipAllButton,

    onCloseClick: () => {
      completeTutorial();
    },

    onDestroyed: () => {
      if (!tutorialDestroyingForCleanup && !tutorialCompleted && user.value?.id) {
        tutorialCompleted = true;
        setTutorialCompleted(user.value.id);
      }
      showTutorialAddModal.value = false;
      showTutorialDemo.value = false;
      tutorialLogMenuStatus.value = null;
      tutorialShowHelpCenterMenu.value = false;
      isTutorialActive.value = false;
      tutorialDriver = null;
    },

    steps: [
      {
        element: () => getCoachElement('my-habits-demo-add'),
        popover: {
          title: MY_HABITS_TUTORIAL_STEP_COPY.welcome.title,
          description: MY_HABITS_TUTORIAL_STEP_COPY.welcome.description,
          side: 'bottom',
          align: 'end',
          showButtons: ['next', 'close'],
          onNextClick: async (_, __, { driver: d }) => {
            await advanceFromAddStep(d);
          },
        },
        onHighlightStarted: () => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (showTutorialAddModal.value) {
            showTutorialAddModal.value = false;
            isTutorialActive.value = false;
          }
        },
      },
      {
        element: () => getCoachElement('my-habits-add-title'),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.title.description,
          side: 'bottom',
          showButtons: ['next', 'previous', 'close'],
          onPrevClick: async (_, __, { driver: d }) => {
            showTutorialAddModal.value = false;
            isTutorialActive.value = false;
            await nextTick();
            d.movePrevious();
          },
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (!el && d.getActiveIndex() === 1) {
            setTimeout(() => d.refresh(), 100);
          }
        },
      },
      {
        element: () => getCoachElement('my-habits-add-description'),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.description.description,
          side: 'bottom',
          showButtons: ['next', 'previous', 'close'],
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (!el) setTimeout(() => d.refresh(), 100);
        },
      },
      {
        element: () => getCoachElement('my-habits-add-skips'),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.skips.description,
          side: 'bottom',
          showButtons: ['next', 'previous', 'close'],
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (!el) setTimeout(() => d.refresh(), 100);
        },
      },
      {
        element: () => getCoachElement('my-habits-add-share'),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.share.description,
          side: 'bottom',
          showButtons: ['next', 'previous', 'close'],
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (!el) setTimeout(() => d.refresh(), 100);
        },
      },
      {
        element: () => getCoachElement('my-habits-add-save'),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.save.description,
          side: 'top',
          showButtons: ['next', 'previous', 'close'],
          onNextClick: async (_, __, { driver: d }) => {
            await advanceFromSaveStep(d);
          },
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
          if (!el) setTimeout(() => d.refresh(), 100);
        },
      },
      {
        element: () => getCoachElement(getTutorialLayout().habitAdded.target),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.habitAdded.description,
          side: getTutorialLayout().habitAdded.side,
          align: getTutorialLayout().habitAdded.align,
          showButtons: ['next', 'previous', 'close'],
          onPrevClick: async (_, __, { driver: d }) => {
            showTutorialAddModal.value = true;
            isTutorialActive.value = true;
            await nextTick();
            const saveTarget = await waitForCoachElement('my-habits-add-save');
            if (!saveTarget) {
              completeTutorial();
              return;
            }
            d.movePrevious();
          },
        },
        onHighlightStarted: () => {
          showTutorialAddModal.value = false;
          isTutorialActive.value = false;
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
        },
      },
      {
        element: () => getCoachElement(getTutorialLayout().statusIntro.target),
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.statusIntro.description,
          side: getTutorialLayout().statusIntro.side,
          align: getTutorialLayout().statusIntro.align,
          showButtons: ['next', 'previous', 'close'],
          onNextClick: async (_, __, { driver: d }) => {
            await advanceFromStatusIntroStep(d);
          },
        },
        onHighlightStarted: (el, _, { driver: d }) => {
          showTutorialAddModal.value = false;
          isTutorialActive.value = false;
          tutorialLogMenuStatus.value = 'completed';
          tutorialShowHelpCenterMenu.value = false;
          if (!el) setTimeout(() => d.refresh(), 100);
        },
      },
      ...statusCoachSteps,
      {
        popover: {
          description: MY_HABITS_TUTORIAL_STEP_COPY.streakHelp.description,
          showButtons: ['next', 'previous', 'close'],
          onNextClick: () => {
            completeTutorial();
          },
          onPrevClick: async (_, __, { driver: d }) => {
            const lastStatus = MY_HABITS_TUTORIAL_STATUS_STEPS.at(-1)?.status;
            if (!lastStatus) {
              d.movePrevious();
              return;
            }
            await movePreviousWithStatusMenu(d, lastStatus);
          },
        },
        onHighlightStarted: () => {
          showTutorialAddModal.value = false;
          isTutorialActive.value = false;
          tutorialLogMenuStatus.value = null;
          tutorialShowHelpCenterMenu.value = false;
        },
      },
    ],
  });

  tutorialDriver.drive(0);
  tutorialStarting = false;
};

const replayTutorial = () => {
  void startTutorial({ force: true });
};



onMounted(() => {
  isMounted.value = true;
  isOnlineMounted.value = isOnline.value;
  // Social state is now initialized globally in default.vue layout
  load();
  if (isOnline.value) {
    api.sync();
  }

  if (route.query.action === 'add') {
    openAddModal();
    const newQuery = { ...route.query };
    delete newQuery.action;
    router.replace({ query: newQuery });
  }
});

onUnmounted(() => {
  cleanupTutorial();
});

watch(lastSyncTime, () => {
  console.log('[Dashboard] Background sync detected, refreshing data...');
  load(true);
});
</script>
