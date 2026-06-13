import { getMyHabitsTutorialViewportRange, type MyHabitsTutorialViewportRange, type MyHabitsTutorialPopoverAlign, type MyHabitsTutorialPopoverSide, type MyHabitsTutorialResponsivePlacement, MY_HABITS_TUTORIAL_TARGETS } from './myHabitsTutorialDemo';

export const INITIAL_TUTORIAL_STEP_COPY = {
  welcome: {
    title: 'Welcome to Habits Social!',
    description: 'Connect with friends, track your habits, and build consistency on your self-improvement journey.',
  },
  pageHelp: {
    title: 'Page Tutorials',
    description: 'Each page has its own tutorial. If you ever feel lost or need a refresher, you can click on the help icon dedicated to the specific page you are on.',
  },
  helpCenter: {
    title: 'Help Center',
    description: 'You can visit the Help Center and browse our Help Articles for more in-depth resources on how to use the app.',
  },
} as const;

export type InitialTutorialResponsiveLayout = {
  range: MyHabitsTutorialViewportRange;
  pageHelp: MyHabitsTutorialResponsivePlacement;
  helpCenter: MyHabitsTutorialResponsivePlacement;
};

export const getInitialTutorialLayout = (width: number): InitialTutorialResponsiveLayout => {
  const range = getMyHabitsTutorialViewportRange(width);

  if (range === 'desktop') {
    return {
      range,
      pageHelp: {
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
      pageHelp: {
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
    pageHelp: {
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
