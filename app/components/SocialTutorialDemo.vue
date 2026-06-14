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
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors">My Habits</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors">Buckets</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-active)] bg-[var(--nav-link-bg-active)] transition-colors">Social</div>
            <div class="px-3 py-1.5 text-sm font-medium rounded-lg text-[var(--nav-link-fg-inactive)] transition-colors flex items-center gap-2">
              Inbox
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
      <template v-if="demoActiveView === 'social'">
      <div class="sticky top-0 md:top-[57px] z-40 bg-surface-inset">
        <div class="px-4 sm:px-0 flex items-end justify-between gap-4 pt-2 pb-2 sm:pt-4">
          <div class="flex items-center gap-3">
            <Users class="w-7 h-7 text-fg-muted shrink-0" />
            <div>
              <h1 class="text-base font-bold tracking-tight text-fg">Social</h1>
              <p class="text-fg-muted text-xs">2 friends</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="w-11 py-2.5 bg-surface-hover text-fg-muted font-semibold rounded-xl transition-all text-sm flex items-center justify-center border border-border-strong/60"
              title="Help on this page"
              tabindex="-1"
            >
              <Lightbulb class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="px-4 sm:px-0 pb-2">
          <div class="flex p-1 bg-surface-raised border border-border-muted rounded-xl relative">
            <button
              type="button"
              class="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase rounded-lg transition-all relative z-10 cursor-pointer"
              :class="demoActiveTab === 'activity' ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted'"
              :data-coach-target="SOCIAL_TUTORIAL_TARGETS.activityTab"
              tabindex="-1"
            >
              Activity
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 text-[11px] font-bold tracking-widest uppercase rounded-lg transition-all relative z-10 cursor-pointer flex items-center justify-center gap-2"
              :class="demoActiveTab === 'friends' ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted'"
              :data-coach-target="SOCIAL_TUTORIAL_TARGETS.friendsTab"
              tabindex="-1"
            >
              Friends
            </button>
            <div
              class="absolute top-1 bottom-1 w-[calc(50%-6px)] bg-surface-hover rounded-lg transition-all duration-300 ease-out z-0 shadow-sm"
              :class="demoActiveTab === 'activity' ? 'left-1' : 'left-[calc(50%+2px)]'"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="demoActiveTab === 'activity'" class="space-y-6">
        <div class="space-y-2 px-0 sm:px-0">
          <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle px-4 sm:px-1 pb-2 mt-2">
            Today
          </h3>

          <div class="space-y-0">
            <div
              v-for="(item, itemIndex) in fakeFeedItems"
              :key="item.id"
              class="activity-content-surface group bg-surface-raised/50 border-b border-border-muted/50 last:border-b-0 sm:border-x sm:border-b sm:border-border-muted/50 p-4 flex flex-col gap-3 shadow-sm sm:rounded-t-2xl sm:rounded-b-2xl sm:border-t"
              :data-coach-target="SOCIAL_TUTORIAL_TARGETS.feedItem"
            >
              <div class="flex items-center gap-4 w-full">
                <UserAvatar
                  :data-coach-target="SOCIAL_TUTORIAL_TARGETS.profilePicture"
                  :src="item.user.photoUrl"
                  container-class="w-10 h-10 bg-surface-muted border border-border-muted cursor-pointer"
                  icon-class="w-5 h-5 text-fg-subtle"
                />

                <div class="flex-1 min-w-0">
                  <div class="text-sm leading-relaxed min-w-0 break-words">
                    <span class="font-bold text-fg mr-1.5">{{ item.user.name }}</span>
                    <span class="text-fg-muted" v-text="item.message"></span>
                  </div>
                </div>
              </div>

              <HabitLogVisualizer
                v-if="item.weeklyStatus"
                :title="item.habit.title"
                :streak-count="item.streakCount"
                :streak-anchor-date="item.streakAnchorDate ?? null"
                :reference-date="today"
                :weekly-status="item.weeklyStatus"
              />

              <div class="flex items-center justify-end w-full">
                <button
                  :data-coach-target="SOCIAL_TUTORIAL_TARGETS.chatButton"
                  type="button"
                  class="p-1 text-fg-subtle flex items-center justify-center gap-1.5 cursor-pointer"
                  tabindex="-1"
                  title="Reply privately"
                >
                  <span class="text-xs font-medium">Chat about this activity</span>
                  <MessageCircle class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="demoActiveTab === 'friends'" class="space-y-3">
        <div class="bg-surface-raised/80 backdrop-blur-sm sm:rounded-2xl rounded-none border-y border-x-0 sm:border border-border-muted/80 overflow-hidden">
          <div class="sm:p-6 sm:pb-0 py-6 pb-0">
            <h2 class="text-sm font-bold uppercase tracking-wider text-fg-subtle mb-2 px-6 sm:px-0">Search Users</h2>
            <form class="flex gap-3 px-6 sm:px-0">
              <div class="relative w-full max-w-md">
                <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input
                  :data-coach-target="SOCIAL_TUTORIAL_TARGETS.search"
                  type="text"
                  placeholder="Search by username..."
                  class="w-full pl-10 pr-4 py-2.5 bg-surface-inset border border-surface-raised rounded-xl outline-none text-fg placeholder-fg-subtle text-sm"
                  tabindex="-1"
                />
              </div>
            </form>
          </div>

          <div class="sm:p-6 py-6">
            <div class="flex items-center justify-between gap-2 mb-2 px-6 sm:px-0">
              <h2 class="text-sm font-bold uppercase tracking-wider text-fg-subtle">My Friends</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div
                v-for="friend in fakeFriends"
                :key="friend.id"
                class="flex items-center gap-4 p-4 bg-transparent border-none rounded-none md:rounded-xl"
              >
                <UserAvatar
                  :src="null"
                  container-class="w-12 h-12 bg-surface-muted"
                  icon-class="w-6 h-6 text-fg-subtle"
                />
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-fg text-sm truncate">
                    {{ friend.name }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>

      <template v-else>
        <div>
          <div class="sticky top-0 md:top-[57px] z-40 bg-surface-inset">
            <div class="px-4 sm:px-0 flex items-end justify-between gap-4 bg-surface-inset pt-2 pb-2 sm:pt-4">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="inline-flex items-center justify-center p-1 -ml-1 text-fg-subtle flex-shrink-0 cursor-pointer"
                  tabindex="-1"
                  title="Back"
                >
                  <ChevronLeft class="w-6 h-6" />
                </button>

                <div class="flex items-center gap-4 ml-1">
                  <UserAvatar
                    :src="fakeFriendProfile.photoUrl"
                    container-class="w-12 h-12 bg-surface-raised rounded-2xl shadow-sm"
                    icon-class="w-6 h-6 text-fg-subtle"
                  />
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h1 class="text-base font-bold tracking-tight text-fg">{{ fakeFriendProfile.username }}</h1>
                    </div>
                    <p class="text-fg-muted text-xs">{{ fakeSharedHabits.length }} habit shared with you</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-date-header-bg border-b sm:border-t border-x-0 sm:border-x border-border-muted/80 py-2 sm:rounded-t-2xl flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4">
            <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] hidden sm:block sm:pr-2"></div>
            <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-2 sm:px-0">
              <div class="flex items-end w-full">
                <div v-for="day in fakeSharedHabits[0]?.weeklyStatus ?? []" :key="day.date" class="flex-1 flex flex-col items-center relative">
                  <div class="text-[10px] uppercase tracking-tighter font-black text-fg-subtle">
                    {{ formatDemoWeekday(day.date) }}
                  </div>
                  <div class="text-[10px] sm:text-xs font-bold text-fg-subtle">
                    {{ formatDemoDay(day.date) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="hidden sm:block w-7 shrink-0"></div>
          </div>

          <div class="friend-content-surface sm:rounded-b-2xl rounded-none overflow-hidden border-b border-x-0 sm:border-x sm:border-b relative will-change-transform transition-colors duration-300 backdrop-blur-md bg-surface-raised/80 border-border-muted/80 divide-y divide-border-muted/80">
            <div
              v-for="habit in fakeSharedHabits"
              :key="habit.id"
              :data-coach-target="SOCIAL_TUTORIAL_TARGETS.friendProfileView"
              class="relative py-3 group transition-all flex flex-col items-stretch sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between gap-x-4 gap-y-2 sm:px-4"
            >
              <div class="w-full px-4 sm:px-0 sm:flex-1 sm:min-w-[200px] flex flex-col gap-1 sm:pr-2">
                <div class="flex justify-between items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-bold text-fg leading-tight break-all transition-colors">
                      {{ habit.title }}
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-inset border border-emerald-500/30 rounded-md shrink-0 align-middle ml-1.5">
                        <Flame class="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
                        <span class="text-[9px] font-black tracking-tight text-emerald-400">
                          x{{ habit.currentStreak }} STREAK
                        </span>
                      </span>
                    </h3>
                  </div>

                </div>

                <div class="text-[10px] font-semibold tracking-tight text-fg-subtle mt-0.5">
                  {{ habit.frequencyText }}
                </div>
              </div>

              <div class="w-full sm:w-[320px] lg:w-[400px] shrink-0 px-4 sm:px-0">
                <div class="flex items-center w-full">
                  <div v-for="day in habit.weeklyStatus" :key="day.date" class="flex-1 flex justify-center">
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 relative"
                      :class="day.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20'
                        : 'bg-transparent border-dashed border-cell-markable-border'"
                    >
                      <Check v-if="day.status === 'completed'" class="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex w-full sm:w-7 shrink-0 items-center justify-end sm:justify-center px-4 sm:px-0">
                <button
                  :data-coach-target="SOCIAL_TUTORIAL_TARGETS.friendProfileHabitChatButton"
                  type="button"
                  class="text-fg-subtle cursor-pointer opacity-70 p-1"
                  tabindex="-1"
                  title="Chat about this habit"
                >
                  <MessageCircle class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-[91] bg-nav-bg border-t border-fg/5 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div class="flex items-center justify-around">
        <div class="flex items-center group transition-colors text-fg-subtle">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <ListChecks class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <PaintBucket class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg">
          <div class="p-2 rounded-xl transition-all duration-300 bg-action-primary/10 scale-110">
            <Users class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle relative">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5">
            <MessageCircle class="w-6 h-6" />
          </div>
        </div>
        <div class="flex items-center group transition-colors text-fg-subtle">
          <div class="p-2 rounded-xl transition-all duration-300 group-hover:bg-action-primary/5 active:bg-action-primary/10">
            <Menu class="w-6 h-6" />
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Check, ChevronLeft, CircleHelp, Flame, Lightbulb, ListChecks, LogOut, Menu, MessageCircle, PaintBucket, Search, Sun, Users } from 'lucide-vue-next';
import {
  SOCIAL_TUTORIAL_FEED_ITEMS,
  SOCIAL_TUTORIAL_FRIEND_PROFILE,
  SOCIAL_TUTORIAL_SHARED_HABITS,
  SOCIAL_TUTORIAL_TARGETS,
  type SocialTutorialDemoView,
} from '~/utils/socialTutorialDemo';

const props = defineProps<{
  activeTab?: 'activity' | 'friends';
  activeView?: SocialTutorialDemoView;
}>();

const today = new Date(2026, 5, 13);
const logoSrc = '/icons/icon-192.png';
const demoRootRef = ref<HTMLElement | null>(null);
const demoActiveTab = ref<'activity' | 'friends'>(props.activeTab ?? 'activity');
const demoActiveView = ref<SocialTutorialDemoView>(props.activeView ?? 'social');

watch(() => props.activeTab, (val) => {
  if (val) demoActiveTab.value = val;
});
watch(() => props.activeView, (val) => {
  if (val) demoActiveView.value = val;
});
const fakeFeedItems = SOCIAL_TUTORIAL_FEED_ITEMS;
const fakeFriendProfile = SOCIAL_TUTORIAL_FRIEND_PROFILE;
const fakeSharedHabits = SOCIAL_TUTORIAL_SHARED_HABITS;

const fakeFriends = [
  { id: 'demo-friend-alex', name: 'Alex' },
  { id: 'demo-friend-sam', name: 'Sam' },
];

const formatDemoWeekday = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatDemoDay = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.getDate().toString();
};
</script>
