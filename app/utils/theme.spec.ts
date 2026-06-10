import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  getNextThemeMode,
  getThemeModeBootstrapScript,
  getThemeToggleText,
  getThemeToggleTitle,
  normalizeThemeMode,
  THEME_STORAGE_KEY,
} from './theme';

/**
 * Minimal Storage mock for environments where happy-dom does not expose
 * a fully functional global localStorage (e.g. @nuxt/test-utils).
 */
const createMockStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  } as Storage;
};

describe('theme mode utilities', () => {
  it('defaults to dark mode when no stored preference exists', () => {
    expect(normalizeThemeMode(null)).toBe(DEFAULT_THEME_MODE);
  });

  it('accepts only the light stored preference', () => {
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('unexpected')).toBe('dark');
  });

  it('toggles between the two supported modes', () => {
    expect(getNextThemeMode('dark')).toBe('light');
    expect(getNextThemeMode('light')).toBe('dark');
  });

  it('describes the next mobile menu action', () => {
    expect(getThemeToggleText('dark')).toBe('Toggle Light Mode');
    expect(getThemeToggleText('light')).toBe('Toggle Dark Mode');
  });

  it('describes the icon button action', () => {
    expect(getThemeToggleTitle('dark')).toBe('Toggle light mode');
    expect(getThemeToggleTitle('light')).toBe('Toggle dark mode');
  });
});

describe('getThemeModeBootstrapScript', () => {
  const bootstrapScript = getThemeModeBootstrapScript();

  beforeAll(() => {
    vi.stubGlobal('localStorage', createMockStorage());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('contains the storage key used by the composable', () => {
    expect(bootstrapScript).toContain(THEME_STORAGE_KEY);
  });

  it('produces a compact synchronous script', () => {
    // Verify it's a viable inline script: starts with an IIFE, contains
    // the key logic, and is under 200 bytes.
    expect(bootstrapScript).toMatch(/^\(function\(\)/);
    expect(bootstrapScript).toContain('classList.remove');
    expect(bootstrapScript).toContain('classList.add');
    expect(bootstrapScript.length).toBeLessThan(200);
  });

  it('switches to light mode when stored preference is "light"', () => {
    document.documentElement.className = 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    // eslint-disable-next-line no-eval
    (0, eval)(bootstrapScript);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    document.documentElement.className = '';
  });

  it('preserves unrelated classes when switching to light mode', () => {
    document.documentElement.className = 'dark foo bar';
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    // eslint-disable-next-line no-eval
    (0, eval)(bootstrapScript);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('foo')).toBe(true);
    expect(document.documentElement.classList.contains('bar')).toBe(true);
    document.documentElement.className = '';
  });

  it('does not force light mode when stored preference is "dark"', () => {
    document.documentElement.className = 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    // eslint-disable-next-line no-eval
    (0, eval)(bootstrapScript);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.className = '';
  });

  it('does not force light mode when no preference is stored', () => {
    document.documentElement.className = 'dark';
    // eslint-disable-next-line no-eval
    (0, eval)(bootstrapScript);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.className = '';
  });

  it('does not force light mode for unexpected stored values', () => {
    document.documentElement.className = 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, 'unexpected');
    // eslint-disable-next-line no-eval
    (0, eval)(bootstrapScript);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.className = '';
  });

  it('fails closed (does not throw) when localStorage throws', () => {
    document.documentElement.className = 'dark';
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => {
      // eslint-disable-next-line no-eval
      (0, eval)(bootstrapScript);
    }).not.toThrow();
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    vi.restoreAllMocks();
    document.documentElement.className = '';
  });
});
