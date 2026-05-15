import './setup';
import { describe, it, expect, vi } from 'vitest';
import { recalculateHabitStreak } from '../utils/streaks';

describe('Streak Engine - Architecture TDD (Strict Queries)', () => {
  it('should not call .where() multiple times on the same query object to avoid Drizzle overwrites', async () => {
    let duplicateWhereCalls = 0;
    
    const createQueryMock = () => {
      let localWhereCalls = 0;
      const queryObj: any = {
        from: vi.fn().mockImplementation(() => queryObj),
        where: vi.fn().mockImplementation(() => {
          localWhereCalls++;
          if (localWhereCalls > 1) {
            duplicateWhereCalls++;
          }
          return queryObj;
        }),
        orderBy: vi.fn().mockImplementation(() => queryObj),
        limit: vi.fn().mockImplementation(() => queryObj),
        set: vi.fn().mockImplementation(() => queryObj),
        returning: vi.fn().mockImplementation(() => Promise.resolve([{ 
            id: '1', 
            longestStreak: 0, 
            streakAnchorDate: null,
            streakCount: 0,
            date: '2024-01-01'
        }])),
        then: (onfulfilled: any) => Promise.resolve([{ 
            id: '1', 
            longestStreak: 0, 
            streakAnchorDate: '2024-01-01',
            streakCount: 0,
            date: '2024-01-01',
            ownerId: 'user-1'
        }]).then(onfulfilled)
      };
      return queryObj;
    };

    const mockDb = {
      select: vi.fn().mockImplementation(createQueryMock),
      update: vi.fn().mockImplementation(createQueryMock),
      execute: vi.fn().mockResolvedValue([]),
    } as any;

    const habitId = '00000000-0000-0000-0000-000000000000';
    const userId = 'user-1';
    const fromDate = '2024-01-01';

    // We expect this to call .where() twice on the logsQuery object in the current implementation
    await recalculateHabitStreak(mockDb, habitId, userId, fromDate);

    // RED PHASE: This should fail on the current codebase
    expect(duplicateWhereCalls, 'Detected multiple .where() calls on a single query object. This causes logic overwrites in Drizzle.').toBe(0);
  });
});
