import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import HabitAddModal, { type TutorialInitialValues } from './HabitAddModal.vue';
import type { UserProfile } from '~/composables/useSocial';
import {
  MY_HABITS_TUTORIAL_FRIENDS,
  MY_HABITS_TUTORIAL_PRIMARY_HABIT,
} from '~/utils/myHabitsTutorialDemo';

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
        Teleport: true,
        ClientOnly: { template: '<slot />' }
      }
    }
  });

const mountTutorialModal = (initialValues?: TutorialInitialValues, friends: UserProfile[] = []) =>
  mount(HabitAddModal, {
    attachTo: document.body,
    props: {
      modelValue: true,
      friends,
      saving: false,
      tutorialReadonly: true,
      initialValues
    },
    global: {
      stubs: {
        Teleport: true,
        ClientOnly: { template: '<slot />' }
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

describe('HabitAddModal tutorial mode', () => {
  it('populates fields from initialValues when tutorialReadonly is true', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      description: MY_HABITS_TUTORIAL_PRIMARY_HABIT.description,
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod,
      skipsCount: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount,
      sharedWith: []
    });

    await nextTick();

    const titleInput = wrapper.find('input[type="text"]');
    expect((titleInput.element as HTMLInputElement).value).toBe(MY_HABITS_TUTORIAL_PRIMARY_HABIT.title);

    const descriptionArea = wrapper.find('textarea');
    expect((descriptionArea.element as HTMLTextAreaElement).value).toBe(MY_HABITS_TUTORIAL_PRIMARY_HABIT.description);

    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe(MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod);

    const numberInput = wrapper.find('input[type="number"]');
    expect((numberInput.element as HTMLInputElement).value).toBe(String(MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount));
  });

  it('never emits save when tutorialReadonly is true', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      description: 'A test habit',
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod,
      skipsCount: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount
    });

    await nextTick();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('disables inputs but keeps the tutorial save button visually active when tutorialReadonly is true', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod
    });

    await nextTick();

    expect(wrapper.find('input[type="text"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    expect(wrapper.find('select').attributes('disabled')).toBeDefined();
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined();

    const saveButton = wrapper.find('[data-coach-target="my-habits-add-save"]');
    expect(saveButton.attributes('disabled')).toBeUndefined();
    expect(saveButton.attributes('aria-disabled')).toBe('true');
  });

  it('uses coach targets that include labels and grouped controls', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      description: MY_HABITS_TUTORIAL_PRIMARY_HABIT.description,
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod,
      skipsCount: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount
    });

    await nextTick();

    const titleTarget = wrapper.get('[data-coach-target="my-habits-add-title"]');
    expect(titleTarget.text()).toContain('Habit Name');
    expect(titleTarget.find('input[type="text"]').exists()).toBe(true);

    const descriptionTarget = wrapper.get('[data-coach-target="my-habits-add-description"]');
    expect(descriptionTarget.text()).toContain('Description');
    expect(descriptionTarget.find('textarea').exists()).toBe(true);

    const skipsTarget = wrapper.get('[data-coach-target="my-habits-add-skips"]');
    expect(skipsTarget.text()).toContain('Skips Allowed');
    expect(skipsTarget.text()).toContain('skips');
    expect(skipsTarget.find('select').exists()).toBe(true);
    expect(skipsTarget.find('input[type="number"]').exists()).toBe(true);
  });

  it('keeps tutorial controls inert when clicked', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod,
      skipsCount: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsCount
    });

    await nextTick();

    const numberInput = wrapper.find('input[type="number"]');
    expect((numberInput.element as HTMLInputElement).value).toBe('2');

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);

    await buttons[1]!.trigger('click');
    await nextTick();

    expect((numberInput.element as HTMLInputElement).value).toBe('2');

    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('normal mode still opens empty and emits correctly', async () => {
    const wrapper = mountModal();

    await nextTick();

    const titleInput = wrapper.find('input[type="text"]');
    expect((titleInput.element as HTMLInputElement).value).toBe('');

    await titleInput.setValue('New test habit');
    await wrapper.find('select').setValue('disabled');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      title: 'New test habit',
      skipsPeriod: 'disabled',
      skipsCount: 0
    });
  });

  it('renders fake share targets and preselected fake friends in tutorial mode', async () => {
    const wrapper = mountTutorialModal({
      title: MY_HABITS_TUTORIAL_PRIMARY_HABIT.title,
      skipsPeriod: MY_HABITS_TUTORIAL_PRIMARY_HABIT.skipsPeriod,
      sharedWith: MY_HABITS_TUTORIAL_PRIMARY_HABIT.sharedWith
    }, MY_HABITS_TUTORIAL_FRIENDS);

    await nextTick();

    expect(wrapper.find('[data-coach-target="my-habits-add-share"]').exists()).toBe(true);
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_FRIENDS[0]!.username);
    expect(wrapper.text()).toContain(MY_HABITS_TUTORIAL_FRIENDS[1]!.username);

    const alexInput = wrapper.find(`input[value="${MY_HABITS_TUTORIAL_FRIENDS[0]!.id}"]`);
    const samInput = wrapper.find(`input[value="${MY_HABITS_TUTORIAL_FRIENDS[1]!.id}"]`);
    expect((alexInput.element as HTMLInputElement).checked).toBe(true);
    expect((samInput.element as HTMLInputElement).checked).toBe(false);
    expect(alexInput.attributes('disabled')).toBeDefined();
    expect(samInput.attributes('disabled')).toBeDefined();
  });
});
