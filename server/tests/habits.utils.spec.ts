import { describe, it, expect } from 'vitest';
import { calculateStreakFromLogs } from '../../utils/habits';

describe('calculateStreakFromLogs', () => {
  it('should correctly calculate a simple 3-day streak', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-02', status: 'completed' },
      { id: '3', date: '2023-01-03', status: 'completed' },
    ];
    const result = calculateStreakFromLogs(logs);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.streakAnchorDate).toBe('2023-01-03');
    expect(result.logUpdates).toHaveLength(3);
    expect(result.logUpdates[0]!.streakCount).toBe(1);
    expect(result.logUpdates[1]!.streakCount).toBe(2);
    expect(result.logUpdates[2]!.streakCount).toBe(3);
  });

  it('should reset streak on a gap longer than 1 day', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-03', status: 'completed' }, // Gap on Jan 2nd
    ];
    const result = calculateStreakFromLogs(logs);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.streakAnchorDate).toBe('2023-01-03');
  });

  it('should reset streak on failure but capture broken streak count', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-02', status: 'completed' },
      { id: '3', date: '2023-01-03', status: 'failed' },
    ];
    const result = calculateStreakFromLogs(logs);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2);
    expect(result.logUpdates).toHaveLength(3);
    expect(result.logUpdates[2]!.brokenStreakCount).toBe(2);
  });

  it('should keep streak intact on skipped or vacation status', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-02', status: 'skipped' },
      { id: '3', date: '2023-01-03', status: 'vacation' },
      { id: '4', date: '2023-01-04', status: 'completed' },
    ];
    const result = calculateStreakFromLogs(logs);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('should NOT reset streak on cleared status', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-02', status: 'cleared' },
    ];
    const result = calculateStreakFromLogs(logs);
    expect(result.currentStreak).toBe(1);
  });

  it('should respect initial running streak', () => {
    const logs = [
      { id: '2', date: '2023-01-02', status: 'completed' },
    ];
    const result = calculateStreakFromLogs(logs, 5, new Date('2023-01-01'));
    expect(result.currentStreak).toBe(6);
  });

  it('should reset streak on a gap created by a cleared log (TDD Verification)', () => {
    const logs = [
      { id: '1', date: '2023-01-01', status: 'completed' },
      { id: '2', date: '2023-01-02', status: 'cleared' },
      { id: '3', date: '2023-01-03', status: 'completed' },
    ];
    const result = calculateStreakFromLogs(logs);
    
    // Day 1: streak 1
    // Day 2: cleared (gap detected against Day 1 when processing Day 3)
    // Day 3: gap is 2 days (3-1). 2 > 1, so streak resets to 0 then +1 for Day 3.
    expect(result.currentStreak).toBe(1);
    // index 0 is Day 1, index 1 is Day 3 (Day 2 'cleared' is skipped in logUpdates)
    expect(result.logUpdates[1]!.streakCount).toBe(1);
  });
});
