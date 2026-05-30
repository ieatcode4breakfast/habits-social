import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { autoExpandTextarea, isMarkable, isStreakFaded } from '../utils/ui';
import { addDays, subDays, formatISO } from 'date-fns';

describe('isStreakFaded', () => {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const twoDaysAgo = subDays(today, 2);

  const formatDate = (d: Date) => formatISO(d, { representation: 'date' });

  it('should NOT be faded if anchor is Today', () => {
    expect(isStreakFaded(formatDate(today))).toBe(false);
  });

  it('should NOT be faded if anchor is Yesterday', () => {
    expect(isStreakFaded(formatDate(yesterday))).toBe(false);
  });

  it('should BE faded if anchor is 2 days ago', () => {
    expect(isStreakFaded(formatDate(twoDaysAgo))).toBe(true);
  });

  it('should NOT be faded if anchor is null', () => {
    expect(isStreakFaded(null)).toBe(false);
  });
});

describe('autoExpandTextarea', () => {
  it('should set textarea height to match its scrollHeight', () => {
    const textarea = document.createElement('textarea');
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 160,
      configurable: true
    });

    autoExpandTextarea(textarea);

    expect(textarea.style.height).toBe('160px');
  });
});

describe('isMarkable', () => {
  const today = new Date('2026-05-30T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows today', () => {
    expect(isMarkable(today)).toBe(true);
  });

  it('allows 6 days ago', () => {
    expect(isMarkable(subDays(today, 6))).toBe(true);
  });

  it('blocks 7 days ago', () => {
    expect(isMarkable(subDays(today, 7))).toBe(false);
  });

  it('blocks tomorrow', () => {
    expect(isMarkable(addDays(today, 1))).toBe(false);
  });
});
