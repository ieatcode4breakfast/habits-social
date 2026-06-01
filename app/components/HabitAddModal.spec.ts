import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import HabitAddModal from './HabitAddModal.vue';

const mountModal = () =>
  mount(HabitAddModal, {
    attachTo: document.body,
    props: {
      modelValue: true,
      friends: [],
      saving: false
    },
    global: {
      stubs: {
        Teleport: true
      }
    }
  });

describe('HabitAddModal skip settings', () => {
  it('emits no skips allowed as disabled with zero skips', async () => {
    const wrapper = mountModal();

    await wrapper.find('input[type="text"]').setValue('No Skip Habit');
    await wrapper.find('select').setValue('disabled');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      title: 'No Skip Habit',
      skipsPeriod: 'disabled',
      skipsCount: 0
    });
  });

  it('emits unlimited skips as none with zero skips', async () => {
    const wrapper = mountModal();

    await wrapper.find('input[type="text"]').setValue('Unlimited Habit');
    await wrapper.find('select').setValue('none');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      title: 'Unlimited Habit',
      skipsPeriod: 'none',
      skipsCount: 0
    });
  });

  it('clamps weekly and monthly skip counts to their allowed ranges', async () => {
    const wrapper = mountModal();

    await wrapper.find('input[type="text"]').setValue('Bounded Habit');
    await wrapper.find('select').setValue('weekly');
    await nextTick();
    await wrapper.find('input[type="number"]').setValue(0);
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      skipsPeriod: 'weekly',
      skipsCount: 1
    });

    await wrapper.find('select').setValue('monthly');
    await nextTick();
    await wrapper.find('input[type="number"]').setValue(99);
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[1]?.[0]).toMatchObject({
      skipsPeriod: 'monthly',
      skipsCount: 27
    });
  });
});
