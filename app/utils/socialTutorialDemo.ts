export type SocialTutorialFeedItem = {
  id: string;
  type: string;
  user: {
    id: string;
    name: string;
    photoUrl: string | null;
  };
  habit: {
    id: string | null;
    title: string;
  };
  message: string;
  date: string;
  weeklyStatus?: { date: string; status: string | undefined }[];
  streakCount?: number;
  streakAnchorDate?: string | null;
};

export type SocialTutorialViewportRange = 'mobile' | 'tablet' | 'desktop';
export type SocialTutorialPopoverSide = 'top' | 'right' | 'bottom' | 'left' | 'over';
export type SocialTutorialPopoverAlign = 'start' | 'center' | 'end';
export type SocialTutorialDemoView = 'social' | 'friendProfile';

export type SocialTutorialResponsivePlacement = {
  target: string;
  side: SocialTutorialPopoverSide;
  align: SocialTutorialPopoverAlign;
};

export type SocialTutorialResponsiveLayout = {
  range: SocialTutorialViewportRange;
  feedItem: SocialTutorialResponsivePlacement;
  profilePicture: SocialTutorialResponsivePlacement;
  chatButton: SocialTutorialResponsivePlacement;
  friendProfileView: SocialTutorialResponsivePlacement;
  friendProfileHabitChatButton: SocialTutorialResponsivePlacement;
  friendsTab: SocialTutorialResponsivePlacement;
  search: SocialTutorialResponsivePlacement;
};

export type SocialTutorialSharedHabit = {
  id: string;
  title: string;
  currentStreak: number;
  streakAnchorDate: string | null;
  frequencyText: string;
  weeklyStatus: { date: string; status: string | undefined }[];
};

export const SOCIAL_TUTORIAL_TARGETS = {
  activityTab: 'social-demo-activity-tab',
  feedItem: 'social-demo-feed-item',
  profilePicture: 'social-demo-profile-picture',
  chatButton: 'social-demo-chat-button',
  friendProfileView: 'social-demo-friend-profile-view',
  friendProfileHabitChatButton: 'social-demo-friend-profile-habit-chat-button',
  friendsTab: 'social-demo-friends-tab',
  search: 'social-demo-search',
} as const;

export const SOCIAL_TUTORIAL_FAKE_USER = {
  id: 'demo-user',
  email: 'test@example.invalid',
  username: 'test',
  photoUrl: '',
};

export const SOCIAL_TUTORIAL_FEED_ITEMS: SocialTutorialFeedItem[] = [
  {
    id: 'demo-feed-1',
    type: 'STREAK_MILESTONE',
    user: {
      id: 'demo-friend-alex',
      name: 'Alex',
      photoUrl: null,
    },
    habit: {
      id: 'demo-morning-walk',
      title: 'Morning walk',
    },
    message: 'completed Morning walk and hit a 7-day streak milestone!',
    date: '2026-06-13',
    weeklyStatus: [
      { date: '2026-06-07', status: 'completed' },
      { date: '2026-06-08', status: 'completed' },
      { date: '2026-06-09', status: 'completed' },
      { date: '2026-06-10', status: 'completed' },
      { date: '2026-06-11', status: 'completed' },
      { date: '2026-06-12', status: 'completed' },
      { date: '2026-06-13', status: 'completed' },
    ],
    streakCount: 7,
  },
];

export const SOCIAL_TUTORIAL_FRIEND_PROFILE = {
  id: 'demo-friend-alex',
  username: 'Alex',
  photoUrl: null,
} as const;

export const SOCIAL_TUTORIAL_SHARED_HABITS: SocialTutorialSharedHabit[] = [
  {
    id: 'demo-morning-walk',
    title: 'Morning walk',
    currentStreak: 7,
    streakAnchorDate: null,
    frequencyText: 'Daily habit',
    weeklyStatus: [
      { date: '2026-06-07', status: 'completed' },
      { date: '2026-06-08', status: 'completed' },
      { date: '2026-06-09', status: 'completed' },
      { date: '2026-06-10', status: 'completed' },
      { date: '2026-06-11', status: 'completed' },
      { date: '2026-06-12', status: 'completed' },
      { date: '2026-06-13', status: 'completed' },
    ],
  },
];

export const SOCIAL_TUTORIAL_STEP_COPY = {
  welcome: {
    title: 'Welcome to Social',
    description: 'See what your friends are up to, track their habit progress, and stay motivated together.',
  },
  activityTab: {
    description: 'The Activity tab shows your friends\' recent habit completions, streaks, and milestones in a feed.',
  },
  feedItem: {
    description: 'Each card tells you who did what — completions, skips, streaks broken or maintained — and shows a 7-day visual.',
  },
  profilePicture: {
    description: 'Click a friend\'s profile picture or name to visit their full profile, see all their shared habits, and follow their streaks.',
  },
  chatButton: {
    description: 'Click the chat icon to send a message to your friend about this specific habit.',
  },
  friendProfile: {
    description: 'A friend\'s profile shows the habits they have shared with you, including recent progress and streaks.',
  },
  friendHabitChatButton: {
    description: 'You can also chat about a habit directly from your friend\'s shared habit list.',
  },
  friendsTab: {
    description: 'The Friends tab lets you search for people, accept incoming requests, and manage your friend list.',
  },
  search: {
    description: 'Search for users by username to send friend requests.',
  },
  finish: {
    title: 'You\'re all set!',
    description: 'Build your social circle and stay motivated together. Replay this tutorial any time from the help button.',
  },
} as const;

export const getSocialTutorialViewportRange = (width: number): SocialTutorialViewportRange => {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const getSocialTutorialLayout = (width: number): SocialTutorialResponsiveLayout => {
  const range = getSocialTutorialViewportRange(width);

  if (range === 'desktop') {
    return {
      range,
      feedItem: { target: SOCIAL_TUTORIAL_TARGETS.feedItem, side: 'right', align: 'center' },
      profilePicture: { target: SOCIAL_TUTORIAL_TARGETS.profilePicture, side: 'right', align: 'center' },
      chatButton: { target: SOCIAL_TUTORIAL_TARGETS.chatButton, side: 'top', align: 'end' },
      friendProfileView: { target: SOCIAL_TUTORIAL_TARGETS.friendProfileView, side: 'bottom', align: 'start' },
      friendProfileHabitChatButton: { target: SOCIAL_TUTORIAL_TARGETS.friendProfileHabitChatButton, side: 'top', align: 'end' },
      friendsTab: { target: SOCIAL_TUTORIAL_TARGETS.friendsTab, side: 'right', align: 'center' },
      search: { target: SOCIAL_TUTORIAL_TARGETS.search, side: 'bottom', align: 'center' },
    };
  }

  return {
    range,
    feedItem: { target: SOCIAL_TUTORIAL_TARGETS.feedItem, side: 'bottom', align: 'center' },
    profilePicture: { target: SOCIAL_TUTORIAL_TARGETS.profilePicture, side: 'bottom', align: 'center' },
    chatButton: { target: SOCIAL_TUTORIAL_TARGETS.chatButton, side: 'top', align: 'center' },
    friendProfileView: { target: SOCIAL_TUTORIAL_TARGETS.friendProfileView, side: 'bottom', align: 'center' },
    friendProfileHabitChatButton: { target: SOCIAL_TUTORIAL_TARGETS.friendProfileHabitChatButton, side: 'top', align: 'center' },
    friendsTab: { target: SOCIAL_TUTORIAL_TARGETS.friendsTab, side: 'bottom', align: 'center' },
    search: { target: SOCIAL_TUTORIAL_TARGETS.search, side: 'bottom', align: 'center' },
  };
};
