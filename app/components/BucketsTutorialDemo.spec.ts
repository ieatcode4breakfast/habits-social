import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BucketsTutorialDemo from './BucketsTutorialDemo.vue';
import {
  BUCKETS_TUTORIAL_FAKE_BUCKETS,
  BUCKETS_TUTORIAL_FAKE_HABITS,
  BUCKETS_TUTORIAL_STEP_COPY,
  BUCKETS_TUTORIAL_STREAK_HELP_PATH,
  BUCKETS_TUTORIAL_TARGETS,
  getBucketsTutorialLayout,
  getBucketsTutorialViewportRange,
} from '~/utils/bucketsTutorialDemo';
import type { MyHabitsTutorialStatusKey } from '~/utils/myHabitsTutorialDemo';

const mountDemo = (logMenuStatus?: MyHabitsTutorialStatusKey | null, showHelpCenterMenu = false, expandedBucketId?: string | null) =>
  mount(BucketsTutorialDemo, {
    props: {
      logMenuStatus,
      showHelpCenterMenu,
      expandedBucketId,
    },
    global: {
      stubs: {
        UserAvatar: true,
        TimelineRow: true,
        LogMenu: true,
      },
    },
  });

describe('BucketsTutorialDemo', () => {
  it('renders only fabricated bucket dashboard data', () => {
    const wrapper = mountDemo();

    expect(wrapper.text()).toContain('Buckets');
    expect(wrapper.text()).toContain(`${BUCKETS_TUTORIAL_FAKE_BUCKETS.length} bucket`);
    expect(wrapper.text()).toContain(BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!.title);
    expect(wrapper.text()).toContain(`${BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!.habits.length} habits`);
    expect(wrapper.text()).not.toContain('Private real bucket');
  });

  it('exposes fake coach targets without requiring real user data props', () => {
    const wrapper = mountDemo();

    expect(wrapper.find('[data-coach-target="buckets-demo-add"]').exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${BUCKETS_TUTORIAL_TARGETS.bucketRow}"]`).exists()).toBe(true);
    expect(wrapper.props()).toMatchObject({
      logMenuStatus: undefined,
      showHelpCenterMenu: false,
      expandedBucketId: undefined,
    });
  });

  it('shows expanded habit rows when expandedBucketId matches', () => {
    const bucket = BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!;
    const wrapper = mountDemo(undefined, false, bucket.id);

    for (const habit of bucket.habits) {
      expect(wrapper.text()).toContain(habit.title);
    }
  });

  it('hides expanded habit rows when expandedBucketId is null', () => {
    const wrapper = mountDemo();

    for (const habit of BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!.habits) {
      expect(wrapper.text()).not.toContain(habit.title);
    }
  });

  it('shows the read-only fake log menu when requested', () => {
    const wrapper = mountDemo('completed');
    const logMenu = wrapper.findComponent({ name: 'LogMenu' });

    expect(logMenu.exists()).toBe(true);
    expect(logMenu.props('optionMode')).toBe('all');
    expect(logMenu.props('habit')).toMatchObject({
      id: BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!.habits[0]!.id,
      title: BUCKETS_TUTORIAL_FAKE_BUCKETS[0]!.habits[0]!.title,
    });
  });

  it('shows the fake mobile Help Center menu when requested', () => {
    const wrapper = mountDemo(undefined, true);

    expect(wrapper.text()).toContain('Help Center');
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

  it('keeps tutorial copy centralized with the streak help link', () => {
    expect(BUCKETS_TUTORIAL_STEP_COPY.welcome.title).toContain('Welcome to Buckets');
    expect(BUCKETS_TUTORIAL_STEP_COPY.completionRule.title).toContain('How bucket completions work');
    expect(BUCKETS_TUTORIAL_STEP_COPY.completionRule.description).toContain('at least 1 habit');
    expect(BUCKETS_TUTORIAL_STEP_COPY.completionRule.description).toContain('all habits');
    expect(BUCKETS_TUTORIAL_STEP_COPY.streakHelp.description).toContain('Bucket streaks');
    expect(BUCKETS_TUTORIAL_STEP_COPY.streakHelp.description).toContain(BUCKETS_TUTORIAL_STREAK_HELP_PATH);
  });

  it('uses distinct tutorial layout rules for mobile, tablet, and desktop ranges', () => {
    expect(getBucketsTutorialViewportRange(375)).toBe('mobile');
    expect(getBucketsTutorialViewportRange(768)).toBe('tablet');
    expect(getBucketsTutorialViewportRange(1280)).toBe('desktop');

    const mobile = getBucketsTutorialLayout(375);
    const tablet = getBucketsTutorialLayout(768);
    const desktop = getBucketsTutorialLayout(1280);

    expect(mobile.created).toMatchObject({
      target: BUCKETS_TUTORIAL_TARGETS.bucketRow,
      side: 'bottom',
      align: 'center',
    });
    expect(tablet.created).toMatchObject({
      target: BUCKETS_TUTORIAL_TARGETS.bucketRow,
      side: 'bottom',
      align: 'center',
    });
    expect(desktop.created).toMatchObject({
      target: BUCKETS_TUTORIAL_TARGETS.bucketRow,
      side: 'right',
      align: 'center',
    });
  });
});
