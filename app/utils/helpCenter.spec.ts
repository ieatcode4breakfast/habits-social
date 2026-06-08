import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_PATH, getHelpArticlePath, getHelpPathHash, normalizeHelpPath, parseHelpPath } from './helpCenter';

describe('helpCenter path utilities', () => {
  it('defaults empty paths to the welcome article', () => {
    expect(normalizeHelpPath().fullPath).toBe(DEFAULT_HELP_PATH);
    expect(normalizeHelpPath('').articlePath).toBe(DEFAULT_HELP_PATH);
  });

  it('accepts internal help paths and preserves hashes separately from article paths', () => {
    const normalized = normalizeHelpPath('/help-center/my-habits#key-rules');

    expect(normalized.fullPath).toBe('/help-center/my-habits#key-rules');
    expect(normalized.articlePath).toBe('/help-center/my-habits');
    expect(normalized.hash).toBe('#key-rules');
    expect(getHelpArticlePath(normalized.fullPath)).toBe('/help-center/my-habits');
    expect(getHelpPathHash(normalized.fullPath)).toBe('#key-rules');
  });

  it('maps the base help path to welcome', () => {
    expect(normalizeHelpPath('/help-center').fullPath).toBe(DEFAULT_HELP_PATH);
  });

  it('rejects external, unsafe, and non-help paths', () => {
    expect(parseHelpPath('https://example.com/help-center/welcome')).toBeNull();
    expect(parseHelpPath('javascript:alert(1)')).toBeNull();
    expect(parseHelpPath('/login')).toBeNull();
    expect(normalizeHelpPath('/login').fullPath).toBe(DEFAULT_HELP_PATH);
  });
});
