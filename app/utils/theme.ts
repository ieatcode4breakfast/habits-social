export const THEME_STORAGE_KEY = 'habits-social-theme-mode';

export type ThemeMode = 'dark' | 'light';

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

export const normalizeThemeMode = (value: string | null): ThemeMode => {
  return value === 'light' ? 'light' : DEFAULT_THEME_MODE;
};

export const getNextThemeMode = (mode: ThemeMode): ThemeMode => {
  return mode === 'light' ? 'dark' : 'light';
};

export const getThemeToggleText = (mode: ThemeMode): string => {
  return mode === 'light' ? 'Toggle Dark Mode' : 'Toggle Light Mode';
};

export const getThemeToggleTitle = (mode: ThemeMode): string => {
  return mode === 'light' ? 'Toggle dark mode' : 'Toggle light mode';
};

/**
 * Generates a synchronous inline `<script>` body that runs during HTML parsing,
 * before the first paint. If the user has a stored `'light'` preference it
 * removes the SSR default `dark` class and adds `light` on `<html>`, preventing
 * a flash of dark mode for light-theme users.
 *
 * The script is intentionally tiny, synchronous (no `async`/`defer`), and
 * fails closed — any exception leaves the SSR default in place.
 */
export const getThemeModeBootstrapScript = (): string => {
  return [
    '(function(){',
    'try{',
    `var s=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    "if(s==='light'){",
    'var h=document.documentElement;',
    "h.classList.remove('dark');",
    "h.classList.add('light');",
    '}',
    '}catch(e){}',
    '})();',
  ].join('');
};
