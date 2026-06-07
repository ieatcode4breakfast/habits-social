import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useHelpArticle } from './useHelpArticle';

type AsyncDataHandler<T> = () => T | Promise<T>;

const mocks = vi.hoisted(() => {
  const captured: {
    handler: AsyncDataHandler<unknown> | null;
    key: (() => string) | null;
  } = {
    handler: null,
    key: null
  };
  const useAsyncDataMock = vi.fn(<T>(key: () => string, handler: AsyncDataHandler<T>) => ({
    handler: captured.handler = handler,
    key: captured.key = key
  }));

  return {
    captured,
    useAsyncDataMock
  };
});

vi.mock('#app', () => ({
  useAsyncData: mocks.useAsyncDataMock
}));

vi.mock('#app/composables/asyncData', () => ({
  useAsyncData: mocks.useAsyncDataMock
}));

vi.mock('nuxt/app', () => ({
  useAsyncData: mocks.useAsyncDataMock
}));

vi.mock('#imports', () => ({
  useAsyncData: mocks.useAsyncDataMock
}));

describe('useHelpArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captured.handler = null;
    mocks.captured.key = null;
  });

  it('uses the latest route path for the async data key and content query', async () => {
    const path = ref('/help-center/welcome');
    const resolveArticle = vi.fn((_articlePath: string) => Promise.resolve(null));

    useHelpArticle(() => path.value, resolveArticle);

    const key = mocks.captured.key;
    const handler = mocks.captured.handler;

    if (!key || !handler) {
      throw new Error('useAsyncData was not called with a key and handler.');
    }

    expect(key()).toBe('help-article-/help-center/welcome');

    await handler();

    expect(resolveArticle).toHaveBeenLastCalledWith('/help-center/welcome');

    path.value = '/help-center/habit-logs-and-streaks';

    expect(key()).toBe('help-article-/help-center/habit-logs-and-streaks');

    await handler();

    expect(resolveArticle).toHaveBeenLastCalledWith('/help-center/habit-logs-and-streaks');
  });
});
