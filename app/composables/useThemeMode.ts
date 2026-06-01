import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  getNextThemeMode,
  getThemeToggleText,
  getThemeToggleTitle,
  normalizeThemeMode,
  type ThemeMode,
} from '~/utils/theme';

export const useThemeMode = () => {
  const themeMode = useState<ThemeMode>('theme-mode', () => DEFAULT_THEME_MODE);

  const isLightMode = computed(() => themeMode.value === 'light');
  const themeToggleText = computed(() => getThemeToggleText(themeMode.value));
  const themeToggleTitle = computed(() => getThemeToggleTitle(themeMode.value));

  const setThemeMode = (mode: ThemeMode): void => {
    themeMode.value = mode;

    if (!import.meta.client) return;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures. The in-memory theme state still updates safely.
    }
  };

  const initializeThemeMode = (): void => {
    if (!import.meta.client) return;

    try {
      const storedThemeMode = window.localStorage.getItem(THEME_STORAGE_KEY);
      themeMode.value = normalizeThemeMode(storedThemeMode);
    } catch {
      themeMode.value = DEFAULT_THEME_MODE;
    }
  };

  const toggleThemeMode = (): void => {
    setThemeMode(getNextThemeMode(themeMode.value));
  };

  return {
    themeMode,
    isLightMode,
    themeToggleText,
    themeToggleTitle,
    initializeThemeMode,
    setThemeMode,
    toggleThemeMode,
  };
};
