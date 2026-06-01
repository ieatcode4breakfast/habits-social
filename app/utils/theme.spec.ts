import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  getNextThemeMode,
  getThemeToggleText,
  getThemeToggleTitle,
  normalizeThemeMode,
} from './theme';

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
