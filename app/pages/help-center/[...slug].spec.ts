import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

// vi.hoisted runs before any hoisted calls (mock, mockNuxtImport, etc.),
// allowing us to reference the mock variable inside the factory.
const navigateToMock = vi.hoisted(() => vi.fn());

// Mock Nuxt auto-imported composables that [...slug].vue relies on.
// mockNuxtImport replaces the composable at the module level, which is
// required because the page component resolves auto-imports to actual
// Nuxt module imports, not global names.
mockNuxtImport('navigateTo', () => navigateToMock);

mockNuxtImport('useRoute', () => () => ({ path: '/help-center/my-habits', hash: '' }));

const { default: HelpCenterPage } = await import('./[...slug].vue');

describe('HelpCenter page returnToApp', () => {
  it('navigates to /habits when close event fires in page mode', async () => {
    const wrapper = mount(HelpCenterPage, {
      global: {
        stubs: {
          HelpCenterUI: defineComponent({
            name: 'HelpCenterUI',
            props: ['mode', 'activePath'],
            emits: ['close'],
            template: '<div data-test="help-center-ui" />',
          }),
        },
      },
    });

    await flushPromises();
    await nextTick();

    // Simulate the "Return to app" button click in page mode,
    // which triggers @close="returnToApp" on HelpCenterUI.
    const helpCenterUI = wrapper.findComponent({ name: 'HelpCenterUI' });
    helpCenterUI.vm.$emit('close');

    await nextTick();

    expect(navigateToMock).toHaveBeenCalledWith('/habits', { replace: true });
  });
});
