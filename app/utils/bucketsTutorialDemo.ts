export type BucketsTutorialFakeHabit = {
  id: string;
  title: string;
  streak: number;
  statusesByDayIndex: Partial<Record<number, string>>;
};

export type BucketsTutorialFakeBucket = {
  id: string;
  title: string;
  streak: number;
  habits: BucketsTutorialFakeHabit[];
  statusesByDayIndex: Partial<Record<number, string>>;
};

export type BucketsTutorialViewportRange = 'mobile' | 'tablet' | 'desktop';
export type BucketsTutorialPopoverSide = 'top' | 'right' | 'bottom' | 'left' | 'over';
export type BucketsTutorialPopoverAlign = 'start' | 'center' | 'end';

export type BucketsTutorialResponsivePlacement = {
  target: string;
  side: BucketsTutorialPopoverSide;
  align: BucketsTutorialPopoverAlign;
};

export type BucketsTutorialResponsiveLayout = {
  range: BucketsTutorialViewportRange;
  created: BucketsTutorialResponsivePlacement;
};

export const BUCKETS_TUTORIAL_TARGETS = {
  add: 'buckets-demo-add',
  bucketRow: 'buckets-demo-bucket-row',
  addName: 'buckets-add-name',
  addDescription: 'buckets-add-description',
  addHabits: 'buckets-add-habits',
  addSave: 'buckets-add-save',
} as const;

export const BUCKETS_TUTORIAL_FAKE_HABITS: BucketsTutorialFakeHabit[] = [
  {
    id: 'demo-morning-walk',
    title: 'Morning walk',
    streak: 5,
    statusesByDayIndex: {
      0: 'completed',
      1: 'completed',
      2: 'skipped',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
    },
  },
  {
    id: 'demo-read-pages',
    title: 'Read 10 pages',
    streak: 5,
    statusesByDayIndex: {
      0: 'completed',
      1: 'completed',
      2: 'completed',
      3: 'vacation',
      4: 'completed',
      5: 'completed',
      6: 'failed',
    },
  },
  {
    id: 'demo-evening-stretch',
    title: 'Evening Stretch',
    streak: 3,
    statusesByDayIndex: {
      0: 'completed',
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'skipped',
      5: 'completed',
      6: 'completed',
    },
  },
];

export const BUCKETS_TUTORIAL_FAKE_BUCKETS: BucketsTutorialFakeBucket[] = [
  {
    id: 'demo-morning-routine',
    title: 'Morning Routine',
    streak: 5,
    habits: BUCKETS_TUTORIAL_FAKE_HABITS.slice(0, 2),
    statusesByDayIndex: {
      0: 'completed',
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'failed',
    },
  },
  {
    id: 'demo-evening-wind-down',
    title: 'Evening Wind-Down',
    streak: 3,
    habits: BUCKETS_TUTORIAL_FAKE_HABITS.slice(2, 3),
    statusesByDayIndex: {
      0: 'completed',
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'skipped',
      5: 'completed',
      6: 'completed',
    },
  },
];

export const BUCKETS_TUTORIAL_STREAK_HELP_PATH = '/help-center/habit-logs-and-streaks';

export const BUCKETS_TUTORIAL_STEP_COPY = {
  welcome: {
    title: 'Welcome to Buckets',
    description: 'Group your habits into custom collections to stay organized. Create a morning routine, evening wind-down, or any category that fits your goals.',
  },
  name: {
    description: 'Give your bucket a clear name. For example: "Morning Routine".',
  },
  description: {
    description: 'Add an optional description to remind yourself what this bucket is for.',
  },
  habits: {
    description: 'Choose which habits belong in this bucket. The selected habits will appear inside when you expand the bucket on the dashboard.',
  },
  save: {
    description: 'Tap "Add Bucket" to save. Tap Next to see what happens after saving.',
  },
  created: {
    description: 'The new bucket appears on your dashboard with its aggregate status and habit count.',
  },
  completionRule: {
    title: 'How bucket completions work',
    description: 'For a day to count as completed for a bucket, you only need two things: at least 1 habit under the bucket must be completed, and all habits under the bucket for that day must be logged (no empty days).',
  },
  streakHelp: {
    description: `Bucket streaks work exactly like habit streaks. For detailed information on how streaks work, visit the Help Center article <a href="${BUCKETS_TUTORIAL_STREAK_HELP_PATH}">Habit Logs and Streaks</a>, or click Finish to get started.`,
  },
} as const;

export const getBucketsTutorialViewportRange = (width: number): BucketsTutorialViewportRange => {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const getBucketsTutorialLayout = (width: number): BucketsTutorialResponsiveLayout => {
  const range = getBucketsTutorialViewportRange(width);

  if (range === 'desktop') {
    return {
      range,
      created: {
        target: BUCKETS_TUTORIAL_TARGETS.bucketRow,
        side: 'right',
        align: 'center',
      },
    };
  }

  return {
    range,
    created: {
      target: BUCKETS_TUTORIAL_TARGETS.bucketRow,
      side: 'bottom',
      align: 'center',
    },
  };
};
