import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, nextTick, ref } from 'vue';
import HabitEditModal from './HabitEditModal.vue';

const mockUpdateHabit = vi.fn();
const mockGetLogs = vi.fn();
const mockShowToast = vi.fn();

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
  isMarkable: () => true
}));

const mountModal = () =>
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
        currentStreak: 0
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
});
