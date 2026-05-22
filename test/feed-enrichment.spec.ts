import { describe, it, expect } from 'vitest';
import { format, subDays, parseISO } from 'date-fns';
import { SocialNarratorService, FeedItem } from '../server/services/social-narrator.service';

describe('SocialNarratorService.enrichWithWeeklyLogs', () => {
  const mockUser = { id: 'u1', name: 'User 1', photoUrl: null };
  const mockHabit = { id: 'h1', title: 'Habit 1' };

  it('should attach weeklyStatusMap to log items relative to the item date', () => {
    const itemDate = '2026-05-18';
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'STREAK_EXTENSION',
        user: mockUser,
        habit: mockHabit,
        message: 'completed Habit 1',
        date: itemDate,
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'completed' },
      { habitId: 'h1', date: '2026-05-17', status: 'completed' },
      { habitId: 'h1', date: '2026-05-16', status: 'skipped' },
      { habitId: 'h1', date: '2026-05-11', status: 'completed' } // Out of range
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeDefined();
    expect(enriched[0]!.weeklyStatus!.length).toBe(7);

    const day18 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-18');
    const day17 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-17');
    const day16 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-16');
    const day12 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-12');
    const day11 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-11');

    expect(day18?.status).toBe('completed');
    expect(day17?.status).toBe('completed');
    expect(day16?.status).toBe('skipped');
    expect(day12).toBeDefined();
    expect(day11).toBeUndefined();
  });

  it('should attach weeklyStatusMap to INITIAL_SKIP items', () => {
    const itemDate = '2026-05-18';
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'INITIAL_SKIP',
        user: mockUser,
        habit: mockHabit,
        message: 'skipped Habit 1',
        date: itemDate,
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'skipped' }
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeDefined();
    const day18 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-18');
    expect(day18?.status).toBe('skipped');
  });

  it('should attach weeklyStatusMap to STREAK_BROKEN items', () => {
    const itemDate = '2026-05-18';
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'STREAK_BROKEN',
        user: mockUser,
        habit: mockHabit,
        message: 'failed Habit 1',
        date: itemDate,
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'failed' }
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeDefined();
    const day18 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-18');
    expect(day18?.status).toBe('failed');
  });

  it('should attach weeklyStatusMap to INITIAL_VACATION items', () => {
    const itemDate = '2026-05-18';
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'INITIAL_VACATION',
        user: mockUser,
        habit: mockHabit,
        message: 'took vacation for Habit 1',
        date: itemDate,
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'vacation' }
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeDefined();
    const day18 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-18');
    expect(day18?.status).toBe('vacation');
  });

  it('should handle missing logs by filling with empty or undefined', () => {
    const itemDate = '2026-05-18';
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'STREAK_EXTENSION',
        user: mockUser,
        habit: mockHabit,
        message: 'completed Habit 1',
        date: itemDate,
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'completed' }
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeDefined();
    const day18 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-18');
    const day17 = enriched[0]!.weeklyStatus!.find(d => d.date === '2026-05-17');
    expect(day18?.status).toBe('completed');
    expect(day17?.status).toBeUndefined();
  });

  it('should not attach weeklyStatusMap to non-log items', () => {
    const feedItems: FeedItem[] = [
      {
        id: '1',
        type: 'SHARE',
        user: mockUser,
        habit: mockHabit,
        message: 'shared Habit 1',
        date: '2026-05-18',
        timestamp: new Date()
      }
    ];

    const logs = [
      { habitId: 'h1', date: '2026-05-18', status: 'completed' }
    ];

    const enriched = SocialNarratorService.enrichWithWeeklyLogs(feedItems, logs);

    expect(enriched[0]!.weeklyStatus).toBeUndefined();
  });
});
