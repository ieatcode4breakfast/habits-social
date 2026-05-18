import { describe, it, expect } from 'vitest';
import { shouldRefreshFeed } from './feed';

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
