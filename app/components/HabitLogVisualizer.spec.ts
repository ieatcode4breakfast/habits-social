import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HabitLogVisualizer from './HabitLogVisualizer.vue';

type HabitLogVisualizerProps = InstanceType<typeof HabitLogVisualizer>['$props'];

const weeklyStatus = [
  { date: '2026-06-02', status: undefined }
];

const mountVisualizer = (props: Partial<HabitLogVisualizerProps> = {}) =>
  mount(HabitLogVisualizer, {
    props: {
      title: 'Meditate',
      weeklyStatus,
      ...props
    }
  });

describe('HabitLogVisualizer streak badge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the shared streak color thresholds and flame threshold', () => {
    const started = mountVisualizer({ streakCount: 2 });
    expect(started.html()).toContain('border-emerald-500/50');
    expect(started.html()).toContain('text-emerald-500');
    expect(started.find('svg').exists()).toBe(false);

    const established = mountVisualizer({ streakCount: 7 });
    expect(established.html()).toContain('border-violet-400/50');
    expect(established.html()).toContain('text-violet-400');
    expect(established.find('svg').exists()).toBe(true);

    const milestone = mountVisualizer({ streakCount: 30 });
    expect(milestone.html()).toContain('border-yellow-400/50');
    expect(milestone.html()).toContain('text-yellow-400');
  });

  it('fades stale streak badges when an anchor date is provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00.000Z'));

    const fresh = mountVisualizer({ streakCount: 7, streakAnchorDate: '2026-06-01' });
    expect(fresh.html()).toContain('opacity-100');

    const stale = mountVisualizer({ streakCount: 7, streakAnchorDate: '2026-05-31' });
    expect(stale.html()).toContain('opacity-30');
  });
});
