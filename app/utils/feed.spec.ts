import { describe, it, expect } from 'vitest';
import { formatActivityMessageInline, shouldRefreshFeed } from './feed';

describe('shouldRefreshFeed', () => {
  const threshold = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  it('should return true for initial load (empty state)', () => {
    expect(shouldRefreshFeed(0, 0, false, threshold, now)).toBe(true);
  });

  it('should return false if data is fresh (within 10 mins)', () => {
    const fiveMinsAgo = now - 5 * 60 * 1000;
    expect(shouldRefreshFeed(fiveMinsAgo, 10, false, threshold, now)).toBe(false);
  });

  it('should return true if data is stale (exceeds 10 mins)', () => {
    const elevenMinsAgo = now - 11 * 60 * 1000;
    expect(shouldRefreshFeed(elevenMinsAgo, 10, false, threshold, now)).toBe(true);
  });

  it('should return true if forced (Pull-to-Refresh)', () => {
    const fiveMinsAgo = now - 5 * 60 * 1000;
    expect(shouldRefreshFeed(fiveMinsAgo, 10, true, threshold, now)).toBe(true);
  });

  it('should return true if stale and empty', () => {
    const elevenMinsAgo = now - 11 * 60 * 1000;
    expect(shouldRefreshFeed(elevenMinsAgo, 0, false, threshold, now)).toBe(true);
  });
});

describe('formatActivityMessageInline', () => {
  it('should preserve supported activity markup', () => {
    expect(formatActivityMessageInline('[U:123]Alex[/U] completed [H]Workout[/H] with [S:7]7 days[/S].'))
      .toBe('<span class="font-bold">Alex</span> completed <strong class="font-bold">Workout</strong> with <strong class="font-bold">7 days</strong>.');
  });

  it('should escape raw HTML before rendering supported markup', () => {
    expect(formatActivityMessageInline('<img src=x onerror=alert(1)> [H]<script>alert(1)</script>[/H]'))
      .toBe('&lt;img src=x onerror=alert(1)&gt; <strong class="font-bold">&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  });
});
