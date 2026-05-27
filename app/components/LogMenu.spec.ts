import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LogMenu from './LogMenu.vue';

const floatingMocks = vi.hoisted(() => ({
  placement: { value: 'top' },
  update: vi.fn(),
  useFloating: vi.fn(() => ({
    floatingStyles: { position: 'fixed', top: '10px', left: '10px' },
    middlewareData: { value: { arrow: { x: 12 } } },
    placement: floatingMocks.placement,
    update: floatingMocks.update
  }))
}));

vi.mock('@floating-ui/vue', () => ({
  useFloating: floatingMocks.useFloating,
  offset: vi.fn(),
  flip: vi.fn(),
  shift: vi.fn(),
  arrow: vi.fn(),
  autoUpdate: vi.fn()
}));

const mountOpenLogMenu = async () => {
  const referenceEl = document.createElement('button');
  document.body.appendChild(referenceEl);

  const wrapper = mount(LogMenu, {
    attachTo: document.body,
    props: {
      habit: null,
      date: null,
      logs: [],
      referenceEl: null
    }
  });

  await wrapper.setProps({
    habit: {
      id: 'habit-1',
      title: 'Drink water',
      skipsPeriod: 'weekly',
      skipsCount: 1,
      sharedWith: []
    } as any,
    date: new Date('2026-05-20T00:00:00'),
    referenceEl
  });

  return wrapper;
};

describe('LogMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.documentElement.className = '';
    floatingMocks.useFloating.mockClear();
    floatingMocks.update.mockClear();
    floatingMocks.placement.value = 'top';
  });

  it('does not lock document scrolling when opened', async () => {
    const wrapper = await mountOpenLogMenu();

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false);

    wrapper.unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false);
  });

  it('prevents scroll gestures on its local overlay', async () => {
    const wrapper = await mountOpenLogMenu();
    const overlay = document.body.querySelector('.touch-none');
    expect(overlay).toBeTruthy();

    const event = new WheelEvent('wheel', { cancelable: true });
    overlay!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    wrapper.unmount();
  });

  it('prevents touch gestures from reaching the page behind it', async () => {
    const wrapper = await mountOpenLogMenu();
    const overlay = document.body.querySelector('.touch-none');
    expect(overlay).toBeTruthy();

    const event = new TouchEvent('touchmove', { cancelable: true });
    overlay!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    wrapper.unmount();
  });

  it('allows outside clicks to close the menu', async () => {
    const wrapper = await mountOpenLogMenu();
    const overlay = document.body.querySelector('.touch-none');
    expect(overlay).toBeTruthy();

    overlay!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('allows status option clicks to select without closing through the backdrop', async () => {
    const wrapper = await mountOpenLogMenu();
    const option = document.body.querySelector('button[title="Complete"]');
    expect(option).toBeTruthy();

    option!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(wrapper.emitted('select')).toEqual([
      [
        expect.objectContaining({ id: 'habit-1' }),
        new Date('2026-05-20T00:00:00'),
        'completed'
      ]
    ]);
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('renders circular status buttons', async () => {
    const wrapper = await mountOpenLogMenu();
    const rendered = document.body.innerHTML;

    expect(rendered).toContain('rounded-full');
    expect(rendered).not.toContain('rounded-lg flex items-center justify-center transition-all border-2 cursor-pointer relative');

    wrapper.unmount();
  });

  it('uses fixed positioning for body-teleported menus', async () => {
    const wrapper = await mountOpenLogMenu();

    expect(floatingMocks.useFloating).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        strategy: 'fixed',
        transform: false,
        open: expect.anything()
      })
    );

    wrapper.unmount();
  });

  it('updates its Floating UI position when the reference element changes', async () => {
    const wrapper = await mountOpenLogMenu();
    floatingMocks.update.mockClear();

    const nextReferenceEl = document.createElement('button');
    document.body.appendChild(nextReferenceEl);

    await wrapper.setProps({ referenceEl: nextReferenceEl });
    await nextTick();
    await nextTick();

    expect(floatingMocks.update).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('places the arrow on the opposite side of the resolved placement', async () => {
    floatingMocks.placement.value = 'bottom';
    const wrapper = await mountOpenLogMenu();

    const arrow = document.body.querySelector('.rotate-45');
    expect(arrow?.getAttribute('style')).toContain('top: -6px');
    expect(arrow?.getAttribute('style')).not.toContain('bottom: -6px');

    wrapper.unmount();
  });
});
