import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { DEFAULT_HELP_PATH } from '~/utils/helpCenter';

const HelpCenterUIStub = defineComponent({
  props: {
    mode: {
      type: String,
      required: true
    },
    activePath: {
      type: String,
      required: true
    },
    titleId: {
      type: String,
      required: false,
      default: undefined
    }
  },
  emits: ['close', 'navigate'],
  template: `
    <section>
      <h1 :id="titleId">Help Center</h1>
      <button data-test="first-focus" type="button">First</button>
      <button data-test="close" type="button" @click="$emit('close')">Close</button>
    </section>
  `
});

vi.doMock('./HelpCenterUI.vue', () => ({
  default: HelpCenterUIStub
}));

const isOpenState = ref(false);
const activePathState = ref(DEFAULT_HELP_PATH);
const useStateMock = vi.fn((key: string, init: () => boolean | string) => {
  if (key === 'help-modal-open') return isOpenState;
  if (key === 'help-modal-active-path') return activePathState;
  return ref(init());
});

vi.doMock('#app', () => ({
  useState: useStateMock
}));

const { useHelpModal } = await import('~/composables/useHelpModal');
const { default: HelpCenterModal } = await import('./HelpCenterModal.vue');

const mountModal = async () => {
  const modal = useHelpModal();
  modal.close();
  modal.activePath.value = DEFAULT_HELP_PATH;

  const wrapper = mount(HelpCenterModal, {
    attachTo: document.body,
    global: {
      stubs: {
        HelpCenterUI: HelpCenterUIStub,
        Teleport: true
      }
    }
  });

  await nextTick();
  return { modal, wrapper };
};

describe('HelpCenterModal', () => {
  it('moves focus inside on open and restores focus on close', async () => {
    document.body.innerHTML = '<button id="opener">Open help</button>';
    const opener = document.getElementById('opener');
    if (!(opener instanceof HTMLButtonElement)) throw new Error('Expected opener button.');
    opener.focus();

    const { modal, wrapper } = await mountModal();

    modal.open('/help-center/buckets');
    await nextTick();
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get('[data-test="first-focus"]').element);

    modal.close();
    await nextTick();
    await flushPromises();

    expect(document.activeElement).toBe(opener);

    wrapper.unmount();
  });

  it('closes on Escape', async () => {
    const { modal, wrapper } = await mountModal();

    modal.open('/help-center/buckets');
    await nextTick();
    await flushPromises();

    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });

    expect(modal.isOpen.value).toBe(false);

    wrapper.unmount();
  });

  it('cycles focus inside the modal on Tab', async () => {
    const { modal, wrapper } = await mountModal();

    modal.open('/help-center/buckets');
    await nextTick();
    await flushPromises();

    const first = wrapper.get('[data-test="first-focus"]').element;
    const last = wrapper.get('[data-test="close"]').element;
    if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
      throw new Error('Expected focusable modal controls.');
    }

    last.focus();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    wrapper.unmount();
  });
});
