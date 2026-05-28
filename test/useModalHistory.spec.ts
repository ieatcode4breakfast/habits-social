import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, nextTick, ref, type ComponentPublicInstance } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { useModalHistory } from '../app/composables/useModalHistory';

interface ModalHistoryVm extends ComponentPublicInstance {
  open: boolean;
  suppressNextHistoryBack: () => void;
}

const setWindowScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
    writable: true,
  });
};

const createTestComponent = () => defineComponent({
  setup() {
    const open = ref(false);
    const modalHistory = useModalHistory(open);
    return { open, ...modalHistory };
  },
  template: '<div></div>',
});

const getVm = (wrapper: VueWrapper): ModalHistoryVm => wrapper.vm as ModalHistoryVm;

describe('useModalHistory scroll lock', () => {
  beforeEach(() => {
    document.body.className = '';
    document.documentElement.className = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '';
    setWindowScrollY(0);

    vi.spyOn(window, 'scrollTo').mockImplementation((_x: number | ScrollToOptions, y?: number) => {
      if (typeof _x === 'object') {
        setWindowScrollY(_x.top ?? 0);
        return;
      }
      setWindowScrollY(y ?? 0);
    });
    vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.className = '';
    document.documentElement.className = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    vi.restoreAllMocks();
  });

  it('locks document scrolling without losing the current scroll position', async () => {
    const wrapper = mount(createTestComponent());
    setWindowScrollY(900);

    getVm(wrapper).open = true;
    await nextTick();

    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-900px');
    expect(document.body.style.overflow).toBe('hidden');

    getVm(wrapper).open = false;
    await nextTick();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 900);
    expect(window.scrollY).toBe(900);

    wrapper.unmount();
  });

  it('keeps the document locked until the final modal closes', async () => {
    const first = mount(createTestComponent());
    const second = mount(createTestComponent());
    setWindowScrollY(420);

    getVm(first).open = true;
    await nextTick();
    getVm(second).open = true;
    await nextTick();

    getVm(first).open = false;
    await nextTick();

    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 420);

    getVm(second).open = false;
    await nextTick();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
    expect(window.scrollY).toBe(420);

    first.unmount();
    second.unmount();
  });

  it('restores pre-existing inline document styles after unlocking', async () => {
    const wrapper = mount(createTestComponent());
    document.body.style.position = 'relative';
    document.body.style.top = '12px';
    document.body.style.left = '3px';
    document.body.style.right = '4px';
    document.body.style.width = '75%';
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '6px';
    document.documentElement.style.overflow = 'auto';
    setWindowScrollY(250);

    getVm(wrapper).open = true;
    await nextTick();
    getVm(wrapper).open = false;
    await nextTick();

    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('12px');
    expect(document.body.style.left).toBe('3px');
    expect(document.body.style.right).toBe('4px');
    expect(document.body.style.width).toBe('75%');
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingRight).toBe('6px');
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(window.scrollY).toBe(250);

    wrapper.unmount();
  });
});
