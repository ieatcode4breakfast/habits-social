import { describe, it, expect } from 'vitest';
import { isStreakFaded } from '../utils/ui';
import { subDays, formatISO } from 'date-fns';

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
    expect(isStreakFaded(null as any)).toBe(false);
  });
});
