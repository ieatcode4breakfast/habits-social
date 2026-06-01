import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, nextTick, ref } from 'vue';
import HabitEditModal from './HabitEditModal.vue';

const mockUpdateHabit = vi.fn();
const mockGetLogs = vi.fn();
const mockShowToast = vi.fn();
const mockIsMarkable = vi.hoisted(() => vi.fn(() => true));

vi.mock('#imports', () => ({
  useHabitsApi: () => ({
    updateHabit: mockUpdateHabit,
    getLogs: mockGetLogs
  }),
  useToast: () => ({
    showToast: mockShowToast
  })
}));

vi.mock('~/composables/useModalHistory', () => ({
  useModalHistory: vi.fn()
}));

vi.mock('~/composables/useCalendar', () => ({
  useCalendar: () => {
    const currentDate = ref(new Date('2026-05-20T00:00:00.000Z'));
    return {
      currentDate,
      days: computed(() => [new Date('2026-05-20T00:00:00.000Z')]),
      prevMonth: vi.fn(),
      nextMonth: vi.fn()
    };
  }
}));

vi.mock('~/utils/ui', () => ({
  getStreakTheme: () => ({
    border: 'border-emerald-500/50',
    text: 'text-emerald-500',
    fill: 'fill-emerald-500/80'
  }),
  isStreakFaded: () => false,
  autoExpandTextarea: vi.fn(),
  isMarkable: mockIsMarkable
}));

const mountModal = (habitOverrides: Record<string, unknown> = {}) =>
  mount(HabitEditModal, {
    attachTo: document.body,
    props: {
      modelValue: true,
      habit: {
        id: 'habit-1',
        title: 'Drink Water',
        description: '',
        skipsCount: 2,
        skipsPeriod: 'weekly',
        color: '#6366f1',
        sharedWith: [],
        currentStreak: 0,
        ...habitOverrides
      } as any,
      friends: [
        { id: 'friend-1', username: 'Alex', photoUrl: '' },
        { id: 'friend-2', username: 'Bea', photoUrl: '' }
      ],
      logs: []
    },
    global: {
      stubs: {
        Teleport: true,
        UserAvatar: true
      }
    }
  });

describe('HabitEditModal sharing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockUpdateHabit.mockReset();
    mockGetLogs.mockReset().mockResolvedValue([]);
    mockShowToast.mockReset();
    mockIsMarkable.mockReset().mockReturnValue(true);
    mockUpdateHabit.mockResolvedValue({ id: 'habit-1', sharedWith: ['friend-1'] });
  });

  it('keeps Share with directly editable and removes the confirmation prompt', async () => {
    const wrapper = mountModal();

    await flushPromises();
    await nextTick();

    expect(wrapper.text()).not.toContain('Update Sharing?');
    expect(wrapper.text()).not.toContain('Edit');
    expect(wrapper.text()).not.toContain('Confirm');

    const friendLabels = wrapper
      .findAll('label')
      .filter((label) => ['Alex', 'Bea'].some((name) => label.text().includes(name)));

    expect(friendLabels).toHaveLength(2);
    friendLabels.forEach((label) => {
      expect(label.classes()).toContain('cursor-pointer');
      expect(label.classes()).not.toContain('pointer-events-none');
    });

    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);

    const firstCheckbox = checkboxes[0];
    if (!firstCheckbox) {
      throw new Error('Expected first sharing checkbox to render');
    }

    await firstCheckbox.setValue(true);
    expect((firstCheckbox.element as HTMLInputElement).checked).toBe(true);
  });

  it('does not show the pointer cursor for locked calendar days', async () => {
    mockIsMarkable.mockReturnValue(false);

    const wrapper = mountModal();

    await flushPromises();
    await nextTick();

    const dayButton = wrapper.find('button.w-8.h-8.rounded-full');

    expect(dayButton.exists()).toBe(true);
    expect(dayButton.classes()).toContain('cursor-default');
    expect(dayButton.classes()).not.toContain('cursor-pointer');
  });

  it('treats legacy weekly zero skip settings as no skips allowed while editing', async () => {
    const wrapper = mountModal({
      skipsPeriod: 'weekly',
      skipsCount: 0
    });

    await flushPromises();
    await nextTick();

    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe('disabled');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
  });

  it('passes normalized skip settings to the log menu while editing', async () => {
    const wrapper = mountModal();

    await flushPromises();
    await nextTick();

    await wrapper.find('select').setValue('disabled');
    await wrapper.find('button.w-8.h-8.rounded-full').trigger('click');

    expect(wrapper.emitted('open-log-menu')?.[0]?.[3]).toMatchObject({
      skipsPeriod: 'disabled',
      skipsCount: 0
    });

    await wrapper.find('select').setValue('monthly');
    await nextTick();
    await wrapper.find('input[type="number"]').setValue(99);
    await wrapper.find('button.w-8.h-8.rounded-full').trigger('click');

    expect(wrapper.emitted('open-log-menu')?.[1]?.[3]).toMatchObject({
      skipsPeriod: 'monthly',
      skipsCount: 27
    });
  });
});
