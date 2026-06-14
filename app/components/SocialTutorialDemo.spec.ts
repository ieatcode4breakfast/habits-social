import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SocialTutorialDemo from './SocialTutorialDemo.vue';
import {
  SOCIAL_TUTORIAL_FEED_ITEMS,
  SOCIAL_TUTORIAL_FRIEND_PROFILE,
  SOCIAL_TUTORIAL_SHARED_HABITS,
  SOCIAL_TUTORIAL_STEP_COPY,
  SOCIAL_TUTORIAL_TARGETS,
  type SocialTutorialDemoView,
  getSocialTutorialLayout,
  getSocialTutorialViewportRange,
} from '~/utils/socialTutorialDemo';

const mountDemo = (activeTab?: 'activity' | 'friends', activeView?: SocialTutorialDemoView) =>
  mount(SocialTutorialDemo, {
    props: {
      activeTab,
      activeView,
    },
    global: {
      stubs: {
        UserAvatar: true,
        HabitLogVisualizer: true,
      },
    },
  });

describe('SocialTutorialDemo', () => {
  it('renders only fabricated social demo data', () => {
    const wrapper = mountDemo();

    expect(wrapper.text()).toContain('Social');
    expect(wrapper.text()).toContain('2 friends');
    expect(wrapper.text()).toContain(SOCIAL_TUTORIAL_FEED_ITEMS[0]!.user.name);
    expect(wrapper.text()).toContain(SOCIAL_TUTORIAL_FEED_ITEMS[0]!.habit.title);
    expect(wrapper.text()).not.toContain('Private real friend');
  });

  it('exposes fake coach targets without requiring real user data props', () => {
    const wrapper = mountDemo();

    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.activityTab}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.feedItem}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.profilePicture}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.chatButton}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.friendsTab}"]`).exists()).toBe(true);

    expect(wrapper.props()).toMatchObject({
      activeTab: undefined,
      activeView: undefined,
    });
  });

  it('shows friends tab coach targets when activeTab is friends', () => {
    const wrapper = mountDemo('friends');

    expect(wrapper.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.search}"]`).exists()).toBe(true);
    expect(wrapper.text()).toContain('Search Users');
    expect(wrapper.text()).toContain('My Friends');
  });

  it('renders fake friend names in the friends tab', () => {
    const wrapper = mountDemo('friends');

    expect(wrapper.text()).toContain('Alex');
    expect(wrapper.text()).toContain('Sam');
  });

  it('renders a fabricated friend profile view with shared habit coach targets', () => {
    const wrapper = mountDemo(undefined, 'friendProfile');
    const profileTarget = wrapper.get(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.friendProfileView}"]`);

    expect(profileTarget.text()).toContain(SOCIAL_TUTORIAL_SHARED_HABITS[0]!.title);
    expect(profileTarget.find(`[data-coach-target="${SOCIAL_TUTORIAL_TARGETS.friendProfileHabitChatButton}"]`).exists()).toBe(true);
    expect(wrapper.text()).toContain(SOCIAL_TUTORIAL_FRIEND_PROFILE.username);
    expect(wrapper.text()).toContain(SOCIAL_TUTORIAL_SHARED_HABITS[0]!.title);
    expect(wrapper.text()).toContain(SOCIAL_TUTORIAL_SHARED_HABITS[0]!.frequencyText);
    expect(wrapper.text()).not.toContain('Private real friend');
  });

  it('renders a self-contained fake desktop nav', () => {
    const wrapper = mountDemo();

    expect(wrapper.find('img[alt="Logo"]').attributes('src')).toBe('/icons/icon-192.png');
    expect(wrapper.text()).toContain('Habits Social');
    expect(wrapper.text()).toContain('My Habits');
    expect(wrapper.text()).toContain('Buckets');
    expect(wrapper.text()).toContain('Social');
    expect(wrapper.text()).toContain('Inbox');
  });

  it('keeps tutorial copy centralized', () => {
    expect(SOCIAL_TUTORIAL_STEP_COPY.welcome.title).toContain('Welcome to Social');
    expect(SOCIAL_TUTORIAL_STEP_COPY.activityTab.description).toContain('Activity tab');
    expect(SOCIAL_TUTORIAL_STEP_COPY.feedItem.description).toContain('Each card');
    expect(SOCIAL_TUTORIAL_STEP_COPY.profilePicture.description).toContain('profile picture');
    expect(SOCIAL_TUTORIAL_STEP_COPY.chatButton.description).toContain('chat icon');
    expect(SOCIAL_TUTORIAL_STEP_COPY.friendProfile.description).toContain('profile');
    expect(SOCIAL_TUTORIAL_STEP_COPY.friendHabitChatButton.description).toContain('shared habit');
    expect(SOCIAL_TUTORIAL_STEP_COPY.friendsTab.description).toContain('Friends tab');
    expect(SOCIAL_TUTORIAL_STEP_COPY.search.description).toContain('Search for users');
    expect(SOCIAL_TUTORIAL_STEP_COPY.finish.title).toContain("You're all set");
  });

  it('uses distinct tutorial layout rules for mobile, tablet, and desktop ranges', () => {
    expect(getSocialTutorialViewportRange(375)).toBe('mobile');
    expect(getSocialTutorialViewportRange(768)).toBe('tablet');
    expect(getSocialTutorialViewportRange(1280)).toBe('desktop');

    const mobile = getSocialTutorialLayout(375);
    const tablet = getSocialTutorialLayout(768);
    const desktop = getSocialTutorialLayout(1280);

    expect(mobile.feedItem).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.feedItem,
      side: 'bottom',
      align: 'center',
    });
    expect(tablet.feedItem).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.feedItem,
      side: 'bottom',
      align: 'center',
    });
    expect(desktop.feedItem).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.feedItem,
      side: 'right',
      align: 'center',
    });
    expect(desktop.chatButton).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.chatButton,
      side: 'top',
      align: 'end',
    });
    expect(desktop.friendProfileView).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.friendProfileView,
      side: 'bottom',
      align: 'start',
    });
    expect(desktop.friendProfileHabitChatButton).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.friendProfileHabitChatButton,
      side: 'top',
      align: 'end',
    });

    expect(mobile.friendsTab).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.friendsTab,
      side: 'bottom',
      align: 'center',
    });
    expect(desktop.friendsTab).toMatchObject({
      target: SOCIAL_TUTORIAL_TARGETS.friendsTab,
      side: 'right',
      align: 'center',
    });
  });
});
