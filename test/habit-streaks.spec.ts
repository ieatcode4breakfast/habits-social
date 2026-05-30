import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type LocalHabit, type LocalHabitLog } from '../app/utils/db';
import { recalculateLocalHabitStreak } from '../app/utils/streaks';

const OWNER_ID = 'test-user-id';
const HABIT_ID = 'habit-1';
const TODAY = '2026-05-30';

const d = (offset: number) => {
  const date = new Date(`${TODAY}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().split('T')[0]!;
};

const seedHabit = async () => {
  const habit: LocalHabit = {
    id: HABIT_ID,
    ownerId: OWNER_ID,
    title: 'Test Habit',
    description: '',
    skipsCount: 0,
    skipsPeriod: 'weekly',
    color: '#6366f1',
    sharedWith: [],
    currentStreak: 99,
    longestStreak: 99,
    streakAnchorDate: d(-1),
    synced: 1,
    updatedAt: Date.now()
  };

  await db.habits.put(habit);
};

const seedHabitLog = async (date: string, streakCount: number) => {
  const log: LocalHabitLog = {
    id: `${HABIT_ID}_${date}`,
    habitId: HABIT_ID,
    ownerId: OWNER_ID,
    date,
    status: 'completed',
    sharedWith: [],
    streakCount,
    brokenStreakCount: 0,
    synced: 1,
    updatedAt: Date.now()
  };

  await db.habitLogs.put(log);
};

const seedBaseline = async () => {
  await db.habitStreakBaselines.put({
    habitId: HABIT_ID,
    ownerId: OWNER_ID,
    startDate: d(-60),
    endDate: TODAY,
    baselineDate: d(-61),
    baselineCurrentStreak: 39,
    baselineLongestStreak: 39,
    baselineStreakAnchorDate: d(-61),
    updatedAt: Date.now()
  });
};

describe('recalculateLocalHabitStreak - partial history baseline handling', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedHabit();
  });

  it('preserves a server-provided 99-day streak when only 60 local history days exist before logging today', async () => {
    await seedBaseline();

    for (let offset = -60; offset <= -1; offset++) {
      await seedHabitLog(d(offset), 99 + offset + 1);
    }

    await seedHabitLog(TODAY, 100);

    const result = await recalculateLocalHabitStreak(HABIT_ID, OWNER_ID, TODAY);

    expect(result?.currentStreak).toBe(100);
    expect(result?.longestStreak).toBe(100);
    expect(result?.streakAnchorDate).toBe(TODAY);
  });

  it('does not overwrite the server-provided streak when partial local history has no baseline', async () => {
    for (let offset = -60; offset <= -1; offset++) {
      await seedHabitLog(d(offset), 99 + offset + 1);
    }

    await seedHabitLog(TODAY, 100);

    const result = await recalculateLocalHabitStreak(HABIT_ID, OWNER_ID, TODAY);

    expect(result?.currentStreak).toBe(99);
    expect(result?.longestStreak).toBe(99);
    expect(result?.streakAnchorDate).toBe(d(-1));
  });
});
