import type { SkipPeriod } from '~/components/HabitAddModal.vue';
import type { UserProfile } from '~/composables/useSocial';

export type MyHabitsTutorialPrimaryHabit = {
  title: string;
  description: string;
  skipsPeriod: SkipPeriod;
  skipsCount: number;
  sharedWith: string[];
};

export type MyHabitsTutorialDashboardHabit = {
  id: string;
  title: string;
  frequency: string;
  streak: number;
  statusesByDayIndex: Partial<Record<number, string>>;
  coachTargetsByDayIndex?: Partial<Record<number, string>>;
};

export type MyHabitsTutorialStatusKey = 'completed' | 'skipped' | 'vacation' | 'failed' | 'cleared';

export type MyHabitsTutorialStatusExplanation = {
  status: MyHabitsTutorialStatusKey;
  label: string;
  description: string;
};

export type MyHabitsTutorialStatusStep = MyHabitsTutorialStatusExplanation & {
  coachTarget: string;
  stepDescription: string;
};

export type MyHabitsTutorialViewportRange = 'mobile' | 'tablet' | 'desktop';
export type MyHabitsTutorialPopoverSide = 'top' | 'right' | 'bottom' | 'left' | 'over';
export type MyHabitsTutorialPopoverAlign = 'start' | 'center' | 'end';

export type MyHabitsTutorialResponsivePlacement = {
  target: string;
  side: MyHabitsTutorialPopoverSide;
  align: MyHabitsTutorialPopoverAlign;
};

export type MyHabitsTutorialPopoverPlacement = Pick<MyHabitsTutorialResponsivePlacement, 'side' | 'align'>;

export type MyHabitsTutorialResponsiveLayout = {
  range: MyHabitsTutorialViewportRange;
  habitAdded: MyHabitsTutorialResponsivePlacement;
  statusIntro: MyHabitsTutorialResponsivePlacement;
  statusMenu: Record<MyHabitsTutorialStatusKey, MyHabitsTutorialPopoverPlacement>;
  replayHelp: MyHabitsTutorialResponsivePlacement;
  helpCenter: MyHabitsTutorialResponsivePlacement;
};

export const MY_HABITS_TUTORIAL_TARGETS = {
  replayHelp: 'my-habits-tutorial-replay-help',
  desktopHelpCenter: 'my-habits-tutorial-desktop-help-center',
  mobileHelpCenter: 'my-habits-tutorial-mobile-help-center',
  addedHabitRow: 'my-habits-demo-added-habit',
  addedHabitSummary: 'my-habits-demo-added-habit-summary',
  logStatus: 'my-habits-demo-log-status',
} as const;

export const MY_HABITS_TUTORIAL_FRIENDS: UserProfile[] = [
  {
    id: 'demo-friend-alex',
    email: 'alex@example.invalid',
    username: 'Alex',
    photoUrl: '',
  },
  {
    id: 'demo-friend-sam',
    email: 'sam@example.invalid',
    username: 'Sam',
    photoUrl: '',
  },
];

export const MY_HABITS_TUTORIAL_PRIMARY_HABIT: MyHabitsTutorialPrimaryHabit = {
  title: 'Morning walk',
  description: 'Walk for 10 minutes in the morning daily.',
  skipsPeriod: 'weekly',
  skipsCount: 2,
  sharedWith: [MY_HABITS_TUTORIAL_FRIENDS[0]!.id],
};

export const MY_HABITS_TUTORIAL_STREAK_HELP_PATH = '/help-center/habit-logs-and-streaks';

export const MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS: Record<MyHabitsTutorialStatusKey, string> = {
  completed: 'my-habits-demo-status-completed',
  skipped: 'my-habits-demo-status-skipped',
  vacation: 'my-habits-demo-status-vacation',
  failed: 'my-habits-demo-status-failed',
  cleared: 'my-habits-demo-status-cleared',
};

export const MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS: Record<MyHabitsTutorialStatusKey, string> = {
  completed: 'my-habits-demo-menu-completed',
  skipped: 'my-habits-demo-menu-skipped',
  vacation: 'my-habits-demo-menu-vacation',
  failed: 'my-habits-demo-menu-failed',
  cleared: 'my-habits-demo-menu-cleared',
};

export const MY_HABITS_TUTORIAL_STATUS_EXPLANATIONS: MyHabitsTutorialStatusExplanation[] = [
  {
    status: 'completed',
    label: 'Completed',
    description: 'counts as doing the habit and keeps the streak moving.',
  },
  {
    status: 'skipped',
    label: 'Skipped',
    description: 'uses one allowed skip without breaking the streak.',
  },
  {
    status: 'vacation',
    label: 'Vacation',
    description: 'like Skip, it pauses the streak for planned time away. It is only available when you run out of Skips.',
  },
  {
    status: 'failed',
    label: 'Failed',
    description: 'records a missed day and breaks the active streak.',
  },
  {
    status: 'cleared',
    label: 'Cleared',
    description: 'removes the status you entered.',
  },
];

export const MY_HABITS_TUTORIAL_STATUS_STEPS: MyHabitsTutorialStatusStep[] = MY_HABITS_TUTORIAL_STATUS_EXPLANATIONS.map(status => ({
  ...status,
  coachTarget: MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS[status.status],
  stepDescription: `${status.label}: ${status.description}`,
}));

export const MY_HABITS_TUTORIAL_PRIMARY_STATUS_COACH_TARGETS_BY_DAY_INDEX: Partial<Record<number, string>> = {
  0: MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS.completed,
  1: MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS.skipped,
  2: MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS.vacation,
  3: MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS.failed,
  4: MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS.cleared,
};

export const MY_HABITS_TUTORIAL_SECONDARY_HABIT: MyHabitsTutorialDashboardHabit = {
  id: 'demo-read-pages',
  title: 'Read 10 pages',
  frequency: '4 skips remaining this month',
  streak: 12,
  statusesByDayIndex: {
    0: 'completed',
    1: 'completed',
    2: 'completed',
    3: 'vacation',
    4: 'completed',
    5: 'completed',
    6: 'completed',
  },
};

export const MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT: MyHabitsTutorialDashboardHabit = {
  id: 'demo-morning-walk',
  title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
  frequency: `${MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount} skips remaining this week`,
  streak: 2,
  statusesByDayIndex: {
    0: 'completed',
    1: 'skipped',
    2: 'vacation',
    3: 'failed',
    6: 'completed',
  },
  coachTargetsByDayIndex: MY_HABITS_TUTORIAL_PRIMARY_STATUS_COACH_TARGETS_BY_DAY_INDEX,
};

export const MY_HABITS_TUTORIAL_DASHBOARD_HABITS = [
  MY_HABITS_TUTORIAL_PRIMARY_DASHBOARD_HABIT,
  MY_HABITS_TUTORIAL_SECONDARY_HABIT,
];

export const MY_HABITS_TUTORIAL_STEP_COPY = {
  welcome: {
    title: 'Welcome to My Habits',
    description: 'This Add button starts a new habit. Let\'s walk through how it works.',
  },
  title: {
    description: `Give your habit a clear, specific name. For example: "${MY_HABITS_TUTORIAL_PRIMARY_HABIT.title}"`,
  },
  description: {
    description: `Add optional details. For example: "${MY_HABITS_TUTORIAL_PRIMARY_HABIT.description}"`,
  },
  skips: {
    description: `Set how many times you can skip per week or month without breaking your streak. Here, ${MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount} skips per week are allowed. You can choose to have unlimited skips or no skips allowed.`,
  },
  share: {
    description: `Choose friends who can see this habit and follow your progress. ${MY_HABITS_TUTORIAL_FRIENDS[0]!.username} is selected in this example. You will need to add friends to see this option.`,
  },
  save: {
    description: 'When ready, tap "Add Habit" to save your new habit. Tap "Next" to see what happens after saving.',
  },
  habitAdded: {
    description: `After saving, ${MY_HABITS_TUTORIAL_PRIMARY_HABIT.title} appears on your My Habits dashboard with its streak and skip allowance.`,
  },
  statusIntro: {
    description: 'Tap a day to log a status. Each status changes that day\'s record and can affect the habit streak differently.',
  },
  replayHelp: {
    description: 'You can replay this tutorial any time by clicking this help button.',
  },
  helpCenter: {
    description: 'For all available Help Center articles, click Help Center.',
  },
  streakHelp: {
    description: `For detailed information on how streaks work, visit the Help Center article <a href="${MY_HABITS_TUTORIAL_STREAK_HELP_PATH}">Habit Logs and Streaks</a>, or click Finish to get started.`,
  },
} as const;

export const getMyHabitsTutorialViewportRange = (width: number): MyHabitsTutorialViewportRange => {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

const DESKTOP_STATUS_MENU_PLACEMENT: Record<MyHabitsTutorialStatusKey, MyHabitsTutorialPopoverPlacement> = {
  completed: { side: 'top', align: 'center' },
  skipped: { side: 'top', align: 'center' },
  vacation: { side: 'top', align: 'center' },
  failed: { side: 'top', align: 'center' },
  cleared: { side: 'top', align: 'center' },
};

const COMPACT_STATUS_MENU_PLACEMENT: Record<MyHabitsTutorialStatusKey, MyHabitsTutorialPopoverPlacement> = {
  completed: { side: 'bottom', align: 'start' },
  skipped: { side: 'bottom', align: 'start' },
  vacation: { side: 'bottom', align: 'center' },
  failed: { side: 'bottom', align: 'center' },
  cleared: { side: 'bottom', align: 'end' },
};

export const getMyHabitsTutorialLayout = (width: number): MyHabitsTutorialResponsiveLayout => {
  const range = getMyHabitsTutorialViewportRange(width);

  if (range === 'desktop') {
    return {
      range,
      habitAdded: {
        target: MY_HABITS_TUTORIAL_TARGETS.addedHabitSummary,
        side: 'right',
        align: 'center',
      },
      statusIntro: {
        target: MY_HABITS_TUTORIAL_TARGETS.logStatus,
        side: 'bottom',
        align: 'center',
      },
      statusMenu: DESKTOP_STATUS_MENU_PLACEMENT,
      replayHelp: {
        target: MY_HABITS_TUTORIAL_TARGETS.replayHelp,
        side: 'bottom',
        align: 'end',
      },
      helpCenter: {
        target: MY_HABITS_TUTORIAL_TARGETS.desktopHelpCenter,
        side: 'bottom',
        align: 'end',
      },
    };
  }

  if (range === 'tablet') {
    return {
      range,
      habitAdded: {
        target: MY_HABITS_TUTORIAL_TARGETS.addedHabitRow,
        side: 'bottom',
        align: 'center',
      },
      statusIntro: {
        target: MY_HABITS_TUTORIAL_TARGETS.logStatus,
        side: 'bottom',
        align: 'center',
      },
      statusMenu: COMPACT_STATUS_MENU_PLACEMENT,
      replayHelp: {
        target: MY_HABITS_TUTORIAL_TARGETS.replayHelp,
        side: 'bottom',
        align: 'end',
      },
      helpCenter: {
        target: MY_HABITS_TUTORIAL_TARGETS.mobileHelpCenter,
        side: 'top',
        align: 'center',
      },
    };
  }

  return {
    range,
    habitAdded: {
      target: MY_HABITS_TUTORIAL_TARGETS.addedHabitRow,
      side: 'bottom',
      align: 'center',
    },
    statusIntro: {
      target: MY_HABITS_TUTORIAL_TARGETS.logStatus,
      side: 'bottom',
      align: 'center',
    },
    statusMenu: COMPACT_STATUS_MENU_PLACEMENT,
    replayHelp: {
      target: MY_HABITS_TUTORIAL_TARGETS.replayHelp,
      side: 'bottom',
      align: 'end',
    },
    helpCenter: {
      target: MY_HABITS_TUTORIAL_TARGETS.mobileHelpCenter,
      side: 'top',
      align: 'center',
    },
  };
};
