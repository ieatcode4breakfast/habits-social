import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { usePullToRefresh } from './usePullToRefresh';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';

describe('usePullToRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTouchEvent = (type: string, clientY: number) => {
    const event = new Event(type) as any;
    event.touches = [{ clientY }];
    event.preventDefault = vi.fn();
    return event as TouchEvent;
  };

  const createTestComponent = (callback: any) => {
    return defineComponent({
      template: '<div ref="container"></div>',
      setup() {
        const container = ref<HTMLElement | null>(null);
        const { isPulling, pullDistance } = usePullToRefresh(callback, 80, { scrollContainer: container });
        return { container, isPulling, pullDistance };
      }
    });
  };

  it('sets isPulling to true on touch start', async () => {
    const callback = vi.fn();
    const wrapper = mount(createTestComponent(callback));
    const container = wrapper.find('div').element as HTMLElement;
    
    container.dispatchEvent(createTouchEvent('touchstart', 100));
    
    expect(wrapper.vm.isPulling).toBe(true);
  });

  it('cancels pull if held without significant movement for 200ms', async () => {
    const callback = vi.fn();
    const wrapper = mount(createTestComponent(callback));
    const container = wrapper.find('div').element as HTMLElement;
    
    container.dispatchEvent(createTouchEvent('touchstart', 100));
    expect(wrapper.vm.isPulling).toBe(true);

    // Simulate 200ms passing
    vi.advanceTimersByTime(200);

    // Should cancel pulling because pullDistance is 0 (< 15)
    expect(wrapper.vm.isPulling).toBe(false);
  });

  it('does not cancel pull if movement exceeds threshold before 200ms', async () => {
    const callback = vi.fn();
    const wrapper = mount(createTestComponent(callback));
    const container = wrapper.find('div').element as HTMLElement;
    
    container.dispatchEvent(createTouchEvent('touchstart', 100));
    expect(wrapper.vm.isPulling).toBe(true);

    // Simulate moving down 50 pixels
    container.dispatchEvent(createTouchEvent('touchmove', 150));
    
    vi.runAllTimers();

    // The timeout should not cancel it because pullDistance > 15
    expect(wrapper.vm.isPulling).toBe(true);
    expect(wrapper.vm.pullDistance).toBeGreaterThan(15);
  });
});
