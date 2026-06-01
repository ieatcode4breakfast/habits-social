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
