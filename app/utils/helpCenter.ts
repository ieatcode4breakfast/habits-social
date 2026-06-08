export const DEFAULT_HELP_PATH = '/help-center/welcome';

const HELP_CENTER_ROOT = '/help-center';
const FALLBACK_BASE_URL = 'https://www.habitssocial.com';

export type HelpCenterMode = 'modal' | 'page';

export interface NormalizedHelpPath {
  fullPath: string;
  articlePath: string;
  hash: string;
}

const getBaseUrl = () => {
  if (import.meta.client) {
    return window.location.origin;
  }

  return FALLBACK_BASE_URL;
};

const buildNormalizedHelpPath = (pathname: string, hash: string): NormalizedHelpPath => {
  const articlePath = pathname === HELP_CENTER_ROOT ? DEFAULT_HELP_PATH : pathname;

  return {
    fullPath: `${articlePath}${hash}`,
    articlePath,
    hash
  };
};

export const parseHelpPath = (path?: string): NormalizedHelpPath | null => {
  const rawPath = path?.trim();
  if (!rawPath) return buildNormalizedHelpPath(DEFAULT_HELP_PATH, '');

  let url: URL;
  try {
    url = new URL(rawPath, getBaseUrl());
  } catch {
    return null;
  }

  if (url.origin !== getBaseUrl()) return null;
  if (url.pathname !== HELP_CENTER_ROOT && !url.pathname.startsWith(`${HELP_CENTER_ROOT}/`)) return null;

  return buildNormalizedHelpPath(url.pathname, url.hash);
};

export const normalizeHelpPath = (path?: string): NormalizedHelpPath => {
  return parseHelpPath(path) ?? buildNormalizedHelpPath(DEFAULT_HELP_PATH, '');
};

export const getHelpArticlePath = (path: string): string => normalizeHelpPath(path).articlePath;

export const getHelpPathHash = (path: string): string => normalizeHelpPath(path).hash;
