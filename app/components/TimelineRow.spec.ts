import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineRow from './TimelineRow.vue';

vi.mock('@/utils/ui', () => ({
  isMarkable: () => true
}));

describe('TimelineRow', () => {
  it('uses circular cells by default and square cells when requested', () => {
    const days = [new Date('2026-05-20T00:00:00.000Z')];

    const circle = mount(TimelineRow, {
      props: {
        days,
        statusMap: {}
      }
    });

    expect(circle.html()).toContain('rounded-full');

    const square = mount(TimelineRow, {
      props: {
        days,
        statusMap: {},
        cellShape: 'square'
      }
    });

    expect(square.html()).toContain('rounded-lg');
  });
});
