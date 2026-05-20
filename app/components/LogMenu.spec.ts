import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LogMenu from './LogMenu.vue';

vi.mock('@floating-ui/vue', () => ({
  useFloating: () => ({
    floatingStyles: { position: 'fixed', top: '10px', left: '10px' },
    middlewareData: { arrow: { x: 12 } }
  }),
  offset: vi.fn(),
  flip: vi.fn(),
  shift: vi.fn(),
  arrow: vi.fn(),
  autoUpdate: vi.fn()
}));

const mountOpenLogMenu = () => {
  const referenceEl = document.createElement('button');
  document.body.appendChild(referenceEl);

  return mount(LogMenu, {
    attachTo: document.body,
    props: {
      habit: {
        id: 'habit-1',
        title: 'Drink water',
        skipsPeriod: 'weekly',
        skipsCount: 1,
        sharedWith: []
      } as any,
      date: new Date('2026-05-20T00:00:00'),
      logs: [],
      referenceEl
    }
  });
};

describe('LogMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('does not lock body scrolling when opened', () => {
    const wrapper = mountOpenLogMenu();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);

    wrapper.unmount();
  });

  it('prevents scroll gestures on its local overlay', () => {
    const wrapper = mountOpenLogMenu();
    const overlay = document.body.querySelector('.touch-none');
    expect(overlay).toBeTruthy();

    const event = new WheelEvent('wheel', { cancelable: true });
    overlay!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    wrapper.unmount();
  });
});
