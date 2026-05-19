import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { usePullToRefresh } from '../app/composables/usePullToRefresh';

describe('usePullToRefresh composable', () => {
  let mockCallback: () => Promise<void>;
  let wrapper: any;

  const createTestComponent = () => {
    return defineComponent({
      setup() {
        const pullToRefresh = usePullToRefresh(mockCallback);
        return { ...pullToRefresh };
      },
      template: '<div></div>'
    });
  };

  beforeEach(() => {
    mockCallback = vi.fn(() => Promise.resolve());
    document.body.className = '';
    window.scrollY = 0;
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    document.body.className = '';
  });

  it('should start pulling on touchstart if scroll is not locked', () => {
    const TestComponent = createTestComponent();
    wrapper = mount(TestComponent);
    
    // Simulate touchstart
    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [{ clientY: 100 } as Touch]
    });
    window.dispatchEvent(touchStartEvent);

    expect(wrapper.vm.isPulling).toBe(true);
  });

  it('should ignore touchstart if window.scrollY is greater than 0', () => {
    window.scrollY = 50;
    const TestComponent = createTestComponent();
    wrapper = mount(TestComponent);
    
    // Simulate touchstart
    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [{ clientY: 100 } as Touch]
    });
    window.dispatchEvent(touchStartEvent);

    expect(wrapper.vm.isPulling).toBe(false);
  });

  it('should ignore touchstart if body has overflow-hidden class (scroll lock)', () => {
    document.body.classList.add('overflow-hidden');
    const TestComponent = createTestComponent();
    wrapper = mount(TestComponent);
    
    // Simulate touchstart
    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [{ clientY: 100 } as Touch]
    });
    window.dispatchEvent(touchStartEvent);

    expect(wrapper.vm.isPulling).toBe(false);
  });

  it('should cancel active pulling if overflow-hidden class is added during touchmove', () => {
    const TestComponent = createTestComponent();
    wrapper = mount(TestComponent);
    
    // 1. Start touch successfully
    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [{ clientY: 100 } as Touch]
    });
    window.dispatchEvent(touchStartEvent);
    expect(wrapper.vm.isPulling).toBe(true);

    // 2. Add overflow-hidden class mid-gesture
    document.body.classList.add('overflow-hidden');

    // 3. Move finger
    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [{ clientY: 150 } as Touch]
    });
    window.dispatchEvent(touchMoveEvent);

    // 4. Expect pulling state to be cleared immediately
    expect(wrapper.vm.isPulling).toBe(false);
  });
});
