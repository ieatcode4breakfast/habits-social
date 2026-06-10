import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  normalizeThemeMode,
  type ThemeMode,
} from '~/utils/theme';

/**
 * Client-only plugin that runs before the root app component mounts.
 *
 * Reads the persisted theme preference from localStorage and initializes the
 * shared `theme-mode` state so Nuxt reactivity does not re-apply the SSR
 * default `dark` class after the synchronous `<head>` bootstrap script has
 * already corrected the first paint.
 *
 * This plugin is excluded from SSR by the `.client.ts` filename convention and
 * is guaranteed to execute in the browser before any component using
 * `useState('theme-mode')` mounts.
 */
export default defineNuxtPlugin(() => {
  let initialMode: ThemeMode;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    initialMode = normalizeThemeMode(stored);
  } catch {
    initialMode = DEFAULT_THEME_MODE;
  }

  useState<ThemeMode>('theme-mode', () => DEFAULT_THEME_MODE).value = initialMode;
});
