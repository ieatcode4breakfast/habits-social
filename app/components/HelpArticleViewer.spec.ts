import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import HelpArticleViewer from './HelpArticleViewer.vue';

const articleMocks = vi.hoisted(() => ({
  requestedPaths: [] as string[],
  useHelpArticleMock: vi.fn((pathGetter: () => string) => {
    articleMocks.requestedPaths.push(pathGetter().split('#')[0] || '/help-center/welcome');
    return {
      data: ref({
        title: 'Help article'
      })
    };
  })
}));

vi.mock('~/composables/useHelpArticle', () => ({
  useHelpArticle: articleMocks.useHelpArticleMock
}));

const ContentRendererStub = defineComponent({
  template: `
    <article>
      <a data-test="internal" href="/help-center/my-habits#key-rules">My Habits</a>
      <a data-test="external" href="https://example.com/help-center/my-habits">External</a>
      <a data-test="target" href="/help-center/buckets" target="_blank">Target</a>
      <a data-test="download" href="/help-center/buckets" download>Download</a>
      <a data-test="non-help" href="/habits">Habits</a>
      <a data-test="hash-only" href="#local-section">Local</a>
      <h2 id="local-section">Local section</h2>
    </article>
  `
});

const mountViewer = async (mode: 'modal' | 'page') => {
  articleMocks.requestedPaths = [];
  articleMocks.useHelpArticleMock.mockClear();
  const navigations: string[] = [];

  const Harness = defineComponent({
    components: {
      HelpArticleViewer
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
        <HelpArticleViewer
          path="/help-center/welcome#intro"
          :mode="mode"
          @navigate="handleNavigate"
        />
      </Suspense>
    `
  });

  const wrapper = mount(Harness, {
    global: {
      stubs: {
        ContentRenderer: ContentRendererStub,
        NuxtLink: defineComponent({
          template: '<a><slot /></a>'
        })
      }
    }
  });

  await flushPromises();
  await nextTick();
  return {
    wrapper,
    navigations
  };
};

describe('HelpArticleViewer', () => {
  it('strips hashes before requesting article content', async () => {
    await mountViewer('modal');

    expect(articleMocks.requestedPaths).toEqual(['/help-center/welcome']);
  });

  it('intercepts normal internal help links in modal mode', async () => {
    const { wrapper, navigations } = await mountViewer('modal');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    wrapper.get('[data-test="internal"]').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigations).toEqual(['/help-center/my-habits#key-rules']);
  });

  it('does not intercept links in page mode', async () => {
    const { wrapper, navigations } = await mountViewer('page');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    wrapper.get('[data-test="internal"]').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(navigations).toEqual([]);
  });

  it('ignores external, modified, target, download, and non-help links in modal mode', async () => {
    const { wrapper, navigations } = await mountViewer('modal');
    const selectors = ['external', 'target', 'download', 'non-help'];

    for (const selector of selectors) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      wrapper.get(`[data-test="${selector}"]`).element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    const modifiedEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    wrapper.get('[data-test="internal"]').element.dispatchEvent(modifiedEvent);

    expect(modifiedEvent.defaultPrevented).toBe(false);
    expect(navigations).toEqual([]);
  });

  it('handles hash-only links locally without emitting navigation', async () => {
    const { wrapper, navigations } = await mountViewer('modal');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    wrapper.get('[data-test="hash-only"]').element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigations).toEqual([]);
  });
});
