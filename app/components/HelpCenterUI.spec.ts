import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';

const navigationLinks = [
  {
    path: '/help-center/welcome',
    title: 'Welcome to Habits Social!',
    tocLinks: []
  },
  {
    path: '/help-center/my-habits',
    title: 'My Habits',
    tocLinks: [
      { id: 'key-rules', text: 'Key rules' },
      { id: 'editing-habits', text: 'Editing habits' }
    ]
  }
];

const useAsyncDataMock = vi.fn(() => ({
  data: ref(navigationLinks),
  pending: ref(false),
  error: ref(null)
}));
const queryCollectionMock = vi.fn(() => ({
  select: vi.fn(() => ({
    all: vi.fn(() => Promise.resolve([]))
  }))
}));
const useHeadMock = vi.fn();

vi.doMock('#imports', () => ({
  useAsyncData: useAsyncDataMock,
  queryCollection: queryCollectionMock,
  useHead: useHeadMock
}));

vi.doMock('#app', () => ({
  useAsyncData: useAsyncDataMock,
  useHead: useHeadMock
}));

vi.doMock('#app/composables/asyncData', () => ({
  useAsyncData: useAsyncDataMock
}));

vi.doMock('nuxt/app', () => ({
  useAsyncData: useAsyncDataMock,
  useHead: useHeadMock
}));

vi.doMock('~/composables/useThemeMode', () => ({
  useThemeMode: () => ({
    isLightMode: ref(false),
    themeToggleTitle: 'Switch theme',
    toggleThemeMode: vi.fn()
  })
}));

const HelpArticleViewerStub = defineComponent({
  props: {
    path: {
      type: String,
      required: true
    },
    mode: {
      type: String,
      required: true
    }
  },
  template: '<article data-test="article-viewer">{{ path }} {{ mode }}</article>'
});

vi.doMock('./HelpArticleViewer.vue', () => ({
  default: HelpArticleViewerStub
}));

const { default: HelpCenterUI } = await import('./HelpCenterUI.vue');

const NuxtLinkStub = defineComponent({
  props: {
    to: {
      type: String,
      required: true
    }
  },
  template: '<a :href="to"><slot /></a>'
});

const mountHelpCenterUI = async (mode: 'modal' | 'page') => {
  const navigations: string[] = [];

  const Harness = defineComponent({
    components: {
      HelpCenterUI
    },
    setup() {
      const handleNavigate = (path: string) => {
        navigations.push(path);
      };

      return {
        mode,
        handleNavigate
      };
    },
    template: `
      <Suspense>
        <HelpCenterUI
          :mode="mode"
          active-path="/help-center/my-habits"
          @navigate="handleNavigate"
        />
      </Suspense>
    `
  });

  const wrapper = mount(Harness, {
    global: {
      stubs: {
        HelpArticleViewer: HelpArticleViewerStub,
        NuxtLink: NuxtLinkStub
      }
    }
  });

  for (let i = 0; i < 3; i++) {
    await flushPromises();
    await nextTick();
  }

  return {
    wrapper,
    navigations
  };
};

describe('HelpCenterUI', () => {
  it('renders TOC subheaders for the active article', async () => {
    const { wrapper } = await mountHelpCenterUI('modal');

    expect(wrapper.text()).toContain('Key rules');
    expect(wrapper.text()).toContain('Editing habits');
  });

  it('emits a hash path when a modal subheader is selected', async () => {
    const { wrapper, navigations } = await mountHelpCenterUI('modal');
    const keyRulesButton = wrapper.findAll('button')
      .find((button) => button.text().trim() === 'Key rules');

    if (!keyRulesButton) throw new Error('Expected Key rules subheader button.');

    await keyRulesButton.trigger('click');

    expect(navigations).toEqual(['/help-center/my-habits#key-rules']);
  });

  it('renders real hash links for page-mode subheaders', async () => {
    const { wrapper } = await mountHelpCenterUI('page');

    expect(wrapper.find('a[href="/help-center/my-habits#key-rules"]').exists()).toBe(true);
  });

  it('uses an internal scroll container for article content', async () => {
    const { wrapper } = await mountHelpCenterUI('modal');

    expect(wrapper.find('main.overflow-y-auto').exists()).toBe(true);
  });
});
