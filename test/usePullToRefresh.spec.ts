import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, ref, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { usePullToRefresh } from '../app/composables/usePullToRefresh';

type AsyncCallback = () => Promise<void>;

interface PullToRefreshVm {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  scrollContainer?: HTMLElement | null;
}

const createTouchPoint = (clientY: number): Touch => ({
  identifier: 1,
  target: document.body,
  clientX: 0,
  clientY,
  pageX: 0,
  pageY: clientY,
  screenX: 0,
  screenY: clientY,
  radiusX: 0,
  radiusY: 0,
  rotationAngle: 0,
  force: 0.5,
} as Touch);

const createTouchEvent = (type: 'touchstart' | 'touchmove' | 'touchend', clientY?: number): Event => {
  const event = new Event(type, { cancelable: true, bubbles: true });

  if (type !== 'touchend') {
    const touch = createTouchPoint(clientY ?? 0);
    Object.defineProperty(event, 'touches', { value: [touch], configurable: true });
    Object.defineProperty(event, 'changedTouches', { value: [touch], configurable: true });
    Object.defineProperty(event, 'targetTouches', { value: [touch], configurable: true });
  }

  return event;
};

describe('usePullToRefresh composable', () => {
  let mockCallback: AsyncCallback;
  let wrapper: VueWrapper<unknown> | null = null;

  const createWindowTestComponent = () => defineComponent({
    setup() {
      const pullToRefresh = usePullToRefresh(mockCallback);
      return { ...pullToRefresh };
    },
    template: '<div></div>'
  });

  const createContainerTestComponent = () => defineComponent({
    setup() {
      const scrollContainer = ref<HTMLElement | null>(null);
      const pullToRefresh = usePullToRefresh(mockCallback, 80, { scrollContainer });
      return { ...pullToRefresh, scrollContainer };
    },
    template: '<div ref="scrollContainer"></div>'
  });

  const getVm = (): PullToRefreshVm => {
    if (!wrapper) {
      throw new Error('Test wrapper is not mounted');
    }

    return wrapper.vm as PullToRefreshVm;
  };

  beforeEach(() => {
    mockCallback = vi.fn(() => Promise.resolve());
    document.body.className = '';
    window.scrollY = 0;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    document.body.className = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start pulling on touchstart if scroll is not locked', () => {
    wrapper = mount(createWindowTestComponent());

    window.dispatchEvent(createTouchEvent('touchstart', 100));

    expect(getVm().isPulling).toBe(true);
  });

  it('should ignore touchstart if window.scrollY is greater than 0', () => {
    window.scrollY = 50;
    wrapper = mount(createWindowTestComponent());

    window.dispatchEvent(createTouchEvent('touchstart', 100));

    expect(getVm().isPulling).toBe(false);
  });

  it('should ignore touchstart if body has overflow-hidden class (scroll lock)', () => {
    document.body.classList.add('overflow-hidden');
    wrapper = mount(createWindowTestComponent());

    window.dispatchEvent(createTouchEvent('touchstart', 100));

    expect(getVm().isPulling).toBe(false);
  });

  it('should cancel active pulling if overflow-hidden class is added during touchmove', () => {
    wrapper = mount(createWindowTestComponent());

    window.dispatchEvent(createTouchEvent('touchstart', 100));
    expect(getVm().isPulling).toBe(true);

    document.body.classList.add('overflow-hidden');
    window.dispatchEvent(createTouchEvent('touchmove', 150));

    expect(getVm().isPulling).toBe(false);
  });

  it('should ignore touches when the nested scroll container is already scrolled down', () => {
    wrapper = mount(createContainerTestComponent());
    const container = wrapper.element as HTMLElement;
    container.scrollTop = 40;

    container.dispatchEvent(createTouchEvent('touchstart', 100));

    expect(getVm().isPulling).toBe(false);
  });

  it('should trigger refresh from the nested scroll container when pulled past the threshold', async () => {
    vi.useFakeTimers();
    wrapper = mount(createContainerTestComponent());
    const container = wrapper.element as HTMLElement;
    container.scrollTop = 0;

    container.dispatchEvent(createTouchEvent('touchstart', 100));
    container.dispatchEvent(createTouchEvent('touchmove', 350));

    await nextTick();

    expect(getVm().isPulling).toBe(true);

    container.dispatchEvent(createTouchEvent('touchend'));

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(getVm().isRefreshing).toBe(true);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(300);

    expect(getVm().isRefreshing).toBe(false);
    expect(getVm().pullDistance).toBe(0);
  });
});
