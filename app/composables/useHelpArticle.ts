import { useAsyncData } from '#app';
import { queryCollection } from '#imports';
import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { getHelpArticlePath } from '~/utils/helpCenter';

function resolveHelpArticle(path: string) {
  return queryCollection('docs').path(path).first();
}

type HelpArticleResolver = typeof resolveHelpArticle;

export function useHelpArticle(path: MaybeRefOrGetter<string>, resolveArticle: HelpArticleResolver = resolveHelpArticle) {
  const articlePath = computed(() => getHelpArticlePath(toValue(path)));

  return useAsyncData(
    () => `help-article-${articlePath.value}`,
    () => resolveArticle(articlePath.value)
  );
}
