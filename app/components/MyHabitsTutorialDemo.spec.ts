import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MyHabitsTutorialDemo from './MyHabitsTutorialDemo.vue';
import {
  MY_HABITS_TUTORIAL_DASHBOARD_HABITS,
  MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS,
  MY_HABITS_TUTORIAL_STATUS_EXPLANATIONS,
  MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS,
  MY_HABITS_TUTORIAL_STATUS_STEPS,
  MY_HABITS_TUTORIAL_STEP_COPY,
  MY_HABITS_TUTORIAL_STREAK_HELP_PATH,
  MY_HABITS_TUTORIAL_TARGETS,
  getMyHabitsTutorialLayout,
  getMyHabitsTutorialViewportRange,
  type MyHabitsTutorialStatusKey,
} from '~/utils/myHabitsTutorialDemo';

const mountDemo = (logMenuStatus?: MyHabitsTutorialStatusKey, showHelpCenterMenu = false) =>
  mount(MyHabitsTutorialDemo, {
    props: {
      logMenuStatus,
      showHelpCenterMenu,
    },
    global: {
      stubs: {
        UserAvatar: true,
        TimelineRow: true,
        LogMenu: true,
      },
    },
  });

describe('MyHabitsTutorialDemo', () => {
  it('renders only fabricated habit dashboard data', () => {
    const wrapper = mountDemo();

    expect(wrapper.text()).toContain('My Habits');
    expect(wrapper.text()).toContain('2 habits');
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_DASHBOARD_HABITS[0]!.title);
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_DASHBOARD_HABITS[1]!.title);
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_DASHBOARD_HABITS[0]!.frequency);
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_DASHBOARD_HABITS[1]!.frequency);
    expect(wrapper.text()).not.toContain('Private real habit');
    expect(wrapper.text()).not.toContain('Sensitive friend');
  });

  it('exposes fake coach targets without requiring real user data props', () => {
    const wrapper = mountDemo();

    expect(wrapper.find('[data-coach-target="my-habits-demo-add"]').exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.desktopHelpCenter}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.replayHelp}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.addedHabitRow}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.addedHabitSummary}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.logStatus}"]`).exists()).toBe(true);
    expect(wrapper.props()).toMatchObject({
      logMenuStatus: undefined,
      showHelpCenterMenu: false,
    });
  });

  it('keeps final tutorial status instructions centralized with the streak help link', () => {
    expect(MY_HABITS_TUTORIAL_STEP_COPY.statusIntro.description).toContain('Tap a day');
    expect(MY_HABITS_TUTORIAL_STATUS_STEPS).toHaveLength(MY_HABITS_TUTORIAL_STATUS_EXPLANATIONS.length);
    expect(MY_HABITS_TUTORIAL_STEP_COPY.replayHelp.description).toContain('replay this tutorial');
    expect(MY_HABITS_TUTORIAL_STEP_COPY.replayHelp.description).not.toContain(MY_HABITS_TUTORIAL_STREAK_HELP_PATH);
    expect(MY_HABITS_TUTORIAL_STEP_COPY.helpCenter.description).toContain('Help Center');
    expect(MY_HABITS_TUTORIAL_STEP_COPY.helpCenter.description).not.toContain(MY_HABITS_TUTORIAL_STREAK_HELP_PATH);
    expect(MY_HABITS_TUTORIAL_STEP_COPY.streakHelp.description).toContain('detailed information');
    expect(MY_HABITS_TUTORIAL_STEP_COPY.streakHelp.description).toContain(MY_HABITS_TUTORIAL_STREAK_HELP_PATH);

    for (const status of MY_HABITS_TUTORIAL_STATUS_EXPLANATIONS) {
      const step = MY_HABITS_TUTORIAL_STATUS_STEPS.find(candidate => candidate.status === status.status);
      expect(step?.stepDescription).toContain(status.label);
      expect(step?.stepDescription).toContain(status.description);
      expect(step?.coachTarget).toBe(MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS[status.status]);
      expect(step?.stepDescription).not.toContain(MY_HABITS_TUTORIAL_STREAK_HELP_PATH);
    }
  });

  it('passes every individual fake status coach target to the primary timeline row', () => {
    const wrapper = mountDemo();
    const firstTimeline = wrapper.findComponent({ name: 'TimelineRow' });
    const coachTargetMap = firstTimeline.props('coachTargetMap') as Record<string, string | undefined>;

    for (const target of Object.values(MY_HABITS_TUTORIAL_STATUS_COACH_TARGETS)) {
      expect(Object.values(coachTargetMap)).toContain(target);
    }
  });

  it('shows the read-only fake log menu with every status target when requested', () => {
    const wrapper = mountDemo('completed');
    const logMenu = wrapper.findComponent({ name: 'LogMenu' });

    expect(logMenu.exists()).toBe(true);
    expect(logMenu.props('optionMode')).toBe('all');
    expect(logMenu.props('menuCoachTarget')).toBe('my-habits-demo-log-menu');
    expect(logMenu.props('coachTargetByStatus')).toEqual(MY_HABITS_TUTORIAL_STATUS_MENU_COACH_TARGETS);
    expect(logMenu.props('habit')).toMatchObject({
      id: MY_HABITS_TUTORIAL_DASHBOARD_HABITS[0]!.id,
      title: MY_HABITS_TUTORIAL_DASHBOARD_HABITS[0]!.title,
    });
  });

  it('shows the fake mobile Help Center menu when requested', () => {
    const wrapper = mountDemo(undefined, true);

    expect(wrapper.find(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.mobileHelpCenter}"]`).exists()).toBe(true);
    expect(wrapper.text()).toContain('Help Center');
  });

  it('renders one fake desktop app-nav Help Center target without duplicating it in the page header', () => {
    const wrapper = mountDemo();

    expect(wrapper.findAll(`[data-coach-target="${MY_HABITS_TUTORIAL_TARGETS.desktopHelpCenter}"]`)).toHaveLength(1);
  });

  it('renders a self-contained fake desktop nav instead of relying on scoped layout styles', () => {
    const wrapper = mountDemo();

    expect(wrapper.find('img[alt="Logo"]').attributes('src')).toBe('/icons/icon-192.png');
    expect(wrapper.find('.nav-link').exists()).toBe(false);
    expect(wrapper.text()).toContain('Habits Social');
    expect(wrapper.text()).toContain('Buckets');
    expect(wrapper.text()).toContain('Social');
    expect(wrapper.text()).toContain('Inbox');
  });

  it('uses the real logo image in the fake mobile Help Center menu', () => {
    const wrapper = mountDemo(undefined, true);

    const logos = wrapper.findAll('img[alt="Logo"]');
    expect(logos.length).toBeGreaterThanOrEqual(2);
    expect(logos.every(logo => logo.attributes('src') === '/icons/icon-192.png')).toBe(true);
  });

  it('uses distinct tutorial layout rules for mobile, tablet, and desktop ranges', () => {
    expect(getMyHabitsTutorialViewportRange(375)).toBe('mobile');
    expect(getMyHabitsTutorialViewportRange(768)).toBe('tablet');
    expect(getMyHabitsTutorialViewportRange(1280)).toBe('desktop');

    const mobile = getMyHabitsTutorialLayout(375);
    const tablet = getMyHabitsTutorialLayout(768);
    const desktop = getMyHabitsTutorialLayout(1280);

    expect(mobile.habitAdded).toMatchObject({
      target: MY_HABITS_TUTORIAL_TARGETS.addedHabitRow,
      side: 'bottom',
      align: 'center',
    });
    expect(tablet.statusMenu.completed).toMatchObject({ side: 'bottom', align: 'start' });
    expect(tablet.statusMenu.skipped).toMatchObject({ side: 'bottom', align: 'start' });
    expect(tablet.statusMenu.vacation).toMatchObject({ side: 'bottom', align: 'center' });
    expect(tablet.statusMenu.failed).toMatchObject({ side: 'bottom', align: 'center' });
    expect(tablet.statusMenu.cleared).toMatchObject({ side: 'bottom', align: 'end' });
    expect(desktop.habitAdded).toMatchObject({
      target: MY_HABITS_TUTORIAL_TARGETS.addedHabitSummary,
      side: 'right',
      align: 'center',
    });
    expect(desktop.statusMenu.completed).toMatchObject({ side: 'top', align: 'center' });
    expect(desktop.statusMenu.skipped).toMatchObject({ side: 'top', align: 'center' });
    expect(desktop.statusMenu.vacation).toMatchObject({ side: 'top', align: 'center' });
    expect(desktop.statusMenu.failed).toMatchObject({ side: 'top', align: 'center' });
    expect(desktop.statusMenu.cleared).toMatchObject({ side: 'top', align: 'center' });
    expect(desktop.replayHelp).toMatchObject({
      target: MY_HABITS_TUTORIAL_TARGETS.replayHelp,
      side: 'bottom',
      align: 'end',
    });
    expect(mobile.helpCenter).toMatchObject({
      target: MY_HABITS_TUTORIAL_TARGETS.mobileHelpCenter,
      side: 'top',
      align: 'center',
    });
    expect(desktop.helpCenter).toMatchObject({
      target: MY_HABITS_TUTORIAL_TARGETS.desktopHelpCenter,
      side: 'bottom',
      align: 'end',
    });
  });
});
