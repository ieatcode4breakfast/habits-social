<template>
  <div
    ref="demoRootRef"
    class="fixed inset-0 z-[90] bg-surface-inset text-fg overflow-y-auto"
  >
    <div class="hidden md:block sticky top-0 z-50 h-[57px] bg-nav-bg border-b border-fg/10">
      <div class="h-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center transition-shadow">
              <img :src="logoSrc" class="w-full h-full object-contain" alt="Logo" />
            </div>
            <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fg to-fg-muted">
              Habits Social
            </span>
          </div>

          <nav class="hidden md:flex items-center gap-1 ml-2">
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-active)] bg-[var(--nav-link-bg-active)] transition-colors">My Habits</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors">Buckets</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors">Social</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors flex items-center gap-2">
              Inbox
              <span class="flex w-2 h-2 bg-rose-500 rounded-full"></span>
            </div>
          </nav>
        </div>

        <div class="flex items-center gap-0">
          <div class="flex items-center gap-2 group text-sm font-medium text-fg-muted px-3 py-2 rounded-xl">
            Hi, test!
          </div>
          <div class="w-px h-6 bg-surface-hover mx-2 shrink-0"></div>
          <button
            type="button"
            class="p-2 text-fg-subtle rounded-lg transition-colors flex items-center justify-center"
            title="Help Center"
            aria-label="Help Center"
            :data-coach-target="MY_HABITS_TUTORIAL_TARGETS.desktopHelpCenter"
            tabindex="-1"
          >
            <CircleHelp class="w-5 h-5" />
          </button>
          <div class="w-px h-6 bg-surface-hover mx-2 shrink-0"></div>
          <div class="p-2 text-fg-subtle rounded-lg flex items-center justify-center">
            <Sun class="w-5 h-5" />
          </div>
          <div class="w-px h-6 bg-surface-hover mx-2 shrink-0"></div>
          <div class="p-2 text-fg-subtle rounded-lg flex items-center justify-center">
            <LogOut class="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>

    <div class="min-h-[100dvh] md:min-h-[calc(100dvh-57px)] max-w-5xl mx-auto px-0 sm:px-6 lg:px-8 pb-20 md:pb-12">
      <div class="sticky top-0 md:top-[57px] z-40 bg-surface-inset">
        <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-surface-inset pt-2 pb-2 sm:pt-4">
          <div class="flex items-center gap-4">
            <UserAvatar
              :src="null"
              container-class="w-10 h-10 bg-surface-raised rounded-xl shadow-sm"
              icon-class="w-6 h-6 text-fg-subtle"
            />
            <div>
              <h1 class="text-base font-bold tracking-tight text-fg">My Habits</h1>
              <p class="text-fg-muted text-xs">2 habits</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="w-11 py-2.5 bg-surface-hover text-fg-muted font-semibold rounded-xl transition-all text-sm flex items-center justify-center border border-border-strong/60"
              title="Help on this page"
              :data-coach-target="MY_HABITS_TUTORIAL_TARGETS.replayHelp"
              tabindex="-1"
            >
              <CircleHelp class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="w-11 sm:w-28 py-2.5 bg-action-primary hover:bg-action-primary-hover text-action-primary-fg font-semibold rounded-xl transition-all shadow-lg shadow-fg-inverted/5 cursor-pointer text-sm flex items-center justify-center gap-2 active:scale-95"
              title="Add Habit"
              data-coach-target="my-habits-demo-add"
              tabindex="-1"
            >
              <Plus class="w-4 h-4" />
              <span class="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>

        <div class="bg-date-header-bg border-b sm:border-t border-x-0 sm:border-x border-border-muted/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
          <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block sm:pr-2"></div>
          <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
            <div class="flex items-end w-full">
              <div v-for="(day, i) in days" :key="i" class="flex-1 flex flex-col items-center relative">
                <div
                  class="text-[10px] uppercase tracking-tighter font-black transition-colors"
                  :class="i === days.length - 1 ? 'text-fg' : 'text-fg-subtle'"
                >
                  {{ format(day, 'EEE') }}
                </div>
                <div
                  class="text-[10px] sm:text-xs font-bold transition-colors"
                  :class="i === days.length - 1 ? 'text-fg' : 'text-fg-subtle'"
                >
                  {{ format(day, 'd') }}
                </div>
              </div>
            </div>
          </div>
          <div class="hidden sm:block w-7 shrink-0"></div>
        </div>
      </div>

      <div class="habits-content-surface sm:rounded-b-2xl rounded-none overflow-hidden border-b border-x-0 sm:border-x sm:border-b relative backdrop-blur-md bg-surface-raised/80 border-border-muted/80">
        <div class="divide-y divide-border-muted/80 w-full">
          <div
            v-for="habit in demoHabits"
            :key="habit.id"
            class="relative py-3 transition-colors flex flex-col items-stretch sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4 bg-surface-raised/80"
            :data-coach-target="habit.id === primaryHabitId ? MY_HABITS_TUTORIAL_TARGETS.addedHabitRow : undefined"
          >
            <div
              class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-1 sm:pr-2"
              :data-coach-target="habit.id === primaryHabitId ? MY_HABITS_TUTORIAL_TARGETS.addedHabitSummary : undefined"
            >
              <div class="flex justify-between items-start gap-4">
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-bold text-fg leading-tight break-all">
                    {{ habit.title }}
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-inset border border-emerald-500/50 rounded-md shrink-0 align-middle ml-1.5">
                      <span class="text-[9px] font-black tracking-tight text-emerald-500">x{{ habit.streak }} STREAK</span>
                    </span>
                  </h3>
                </div>
              </div>
              <div class="text-[10px] font-semibold tracking-tight text-fg-subtle mt-0.5">
                {{ habit.frequency }}
              </div>
            </div>

            <div
              :data-coach-target="habit.id === primaryHabitId ? MY_HABITS_TUTORIAL_TARGETS.logStatus : undefined"
            >
              <TimelineRow
                :days="days"
                :reference-date="today"
                :status-map="buildStatusMap(habit)"
                :coach-target-map="buildCoachTargetMap(habit)"
              />
            </div>

            <div class="hidden sm:flex w-7 shrink-0 items-center justify-center">
              <MessageCircle class="w-5 h-5 text-fg-subtle opacity-70" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <LogMenu
      v-if="logMenuStatus"
      :habit="tutorialLogHabit"
      :date="today"
      :logs="tutorialLogMenuLogs"
      :reference-el="logMenuReferenceRef"
      option-mode="all"
      menu-coach-target="my-habits-demo-log-menu"
      :coach-target-by-status="MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS"
      @select="handleTutorialLogMenuSelect"
      @close="handleTutorialLogMenuClose"
    />

    <!-- Mobile Bottom Navigation -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-[91] bg-nav-bg border-t border-fg/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around">
        <div class="flex items-center group transition-colors text-fg">
          <div class="p-2 rounded-xl transition-all duration-300 bg-action-primary/10 scale-110">
            <ListChecks class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <PaintBucket class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle relative">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <Users class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle relative">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <MessageCircle class="w-6 h-6" />
          </div>
          <div class="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-surface-muted"></div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5 active:bg-action-primary/10">
            <Menu class="w-6 h-6" />
          </div>
        </div>
      </div>
    </nav>

    <div
      v-if="showHelpCenterMenu"
      class="fixed inset-x-0 top-0 bottom-[calc(4rem-6px+env(safe-area-inset-bottom,0px))] z-[92] bg-black/80 backdrop-blur-sm touch-none lg:hidden"
    ></div>
    <div
      v-if="showHelpCenterMenu"
      class="fixed inset-x-0 bottom-[calc(4rem-6px+env(safe-area-inset-bottom,0px))] z-[93] flex flex-col justify-end lg:hidden pointer-events-none"
    >
      <div class="relative w-full bg-surface-muted border-t border-border-muted rounded-t-3xl overflow-hidden pointer-events-auto">
        <div class="p-4 border-b border-border-muted">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center">
              <img :src="logoSrc" class="w-full h-full object-contain" alt="Logo" />
            </div>
            <span class="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fg to-fg-muted">
              Habits Social
            </span>
          </div>
        </div>

        <div class="p-2 flex flex-col gap-1 bg-surface-inset">
          <div class="w-full p-2 flex items-center gap-3 text-fg-muted rounded-xl">
            <UserIcon class="w-5 h-5 text-fg-muted" />
            <span class="font-semibold">Edit Profile</span>
          </div>
          <div
            class="w-full p-2 flex items-center gap-3 text-fg-muted rounded-xl"
            :data-coach-target="MY_HABITS_TUTORIAL_TARGETS.mobileHelpCenter"
          >
            <CircleHelp class="w-5 h-5 text-fg-muted" />
            <span class="font-semibold">Help Center</span>
          </div>
          <div class="w-full p-2 flex items-center gap-3 text-rose-500 rounded-xl">
            <LogOut class="w-5 h-5 opacity-80" />
            <span class="font-semibold">Log out</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { subDays, format } from 'date-fns';
import { CircleHelp, ListChecks, LogOut, Menu, MessageCircle, PaintBucket, Plus, Sun, User as UserIcon, Users } from 'lucide-vue-next';
import type { Habit, HabitLog } from '~/composables/useHabitsApi';
import {
  MY_HABITS_TUTORIAL_DASHBOARD_HABITS,
  MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT,
  MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS,
  MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS,
  MY_HABITS_TUTORIAL_TARGETS,
  type MyHabitsTutorialDashboardHabit,
  type MyHabitsTutorialStatusKey,
} from '~/utils/myHabitsTutorialDemo';

const props = defineProps<{
  logMenuStatus?: MyHabitsTutorialStatusKey | null;
  showHelpCenterMenu?: boolean;
}>();

const today = new Date(2026, 5, 13);
const logoSrc = '/icons/icon-192.png';
const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
const primaryHabitId = MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT.id;
const dateKey = (index: number) => format(days[index]!, 'yyyy-MM-dd');
const demoRootRef = ref<HTMLElement | null>(null);
const logMenuReferenceRef = ref<HTMLElement | null>(null);

const tutorialLogHabit: Habit = {
  id: MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT.id,
  ownerId: 'demo-user',
  title: MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT.title,
  description: '',
  skipsCount: 2,
  skipsPeriod: 'weekly',
  color: '#10b981',
  sharedWith: [],
  currentStreak: MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT.streak,
};

const tutorialLogMenuLogs: HabitLog[] = [];

const buildStatusMap = (habit: MyHabitsTutorialDashboardHabit) => {
  return Object.entries(habit.statusesByDayIndex).reduce<Record<string, string | undefined>>((map, [index, status]) => {
    map[dateKey(Number(index))] = status;
    return map;
  }, {});
};

const buildCoachTargetMap = (habit: MyHabitsTutorialDashboardHabit) => {
  return Object.entries(habit.coachTargetsByDayIndex ?? {}).reduce<Record<string, string | undefined>>((map, [index, target]) => {
    map[dateKey(Number(index))] = target;
    return map;
  }, {});
};

const demoHabits = MY_HABITS_TUTORIAL_DASHBOARD_HABITS;

watch(
  () => props.logMenuStatus,
  async (status) => {
    if (!status) {
      logMenuReferenceRef.value = null;
      return;
    }

    await nextTick();
    const target = MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS[status];
    const selector = `[data-coach-target="${target}"]`;
    const targetElement = demoRootRef.value?.querySelector<HTMLElement>(selector) ?? null;
    logMenuReferenceRef.value = targetElement;
  },
  { immediate: true, flush: 'post' }
);

const handleTutorialLogMenuSelect = () => {};
const handleTutorialLogMenuClose = () => {};
</script>
