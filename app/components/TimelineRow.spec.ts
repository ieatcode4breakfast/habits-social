import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
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

  it('lets read-only day clicks bubble to parent rows', async () => {
    const days = [new Date('2026-05-20T00:00:00.000Z')];
    const ParentRow = defineComponent({
      components: { TimelineRow },
      setup() {
        const parentClicks = ref(0);
        const onParentClick = () => {
          parentClicks.value += 1;
        };

        return { days, parentClicks, onParentClick };
      },
      template: `
        <div data-test-id="parent-row" @click="onParentClick">
          <TimelineRow :days="days" :status-map="{}" />
        </div>
      `
    });

    const wrapper = mount(ParentRow);
    await wrapper.find('.w-8.h-8').trigger('click');

    expect(wrapper.vm.parentClicks).toBe(1);
  });

  it('stops interactive day clicks and emits click-day for log menus', async () => {
    const days = [new Date('2026-05-20T00:00:00.000Z')];
    const ParentRow = defineComponent({
      components: { TimelineRow },
      setup() {
        const parentClicks = ref(0);
        const onParentClick = () => {
          parentClicks.value += 1;
        };

        return { days, parentClicks, onParentClick };
      },
      template: `
        <div data-test-id="parent-row" @click="onParentClick">
          <TimelineRow interactive :days="days" :status-map="{}" />
        </div>
      `
    });

    const wrapper = mount(ParentRow);
    const timeline = wrapper.findComponent(TimelineRow);

    await timeline.find('button').trigger('click');

    expect(wrapper.vm.parentClicks).toBe(0);
    expect(timeline.emitted('click-day')).toHaveLength(1);
    expect(timeline.emitted('click-day')?.[0]?.[0]).toEqual(days[0]);
  });
});
