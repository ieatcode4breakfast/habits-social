import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { db } from '~/utils/db';
import { useHabitsApi, _resetSyncState, type Bucket, type BucketLog, type Habit, type HabitLog } from './useHabitsApi';

const OWNER_ID = 'test-user-id';
const HABIT_ID = 'habit-1';
const BUCKET_ID = 'bucket-1';
const TODAY = '2026-05-30';

const mockClient = {
  fetchSync: vi.fn(),
  postHabit: vi.fn(),
  putHabit: vi.fn(),
  deleteHabit: vi.fn(),
  postReorderHabits: vi.fn(),
  postHabitLog: vi.fn(),
  postBucket: vi.fn(),
  putBucket: vi.fn(),
  deleteBucket: vi.fn(),
  postReorderBuckets: vi.fn(),
  postBucketLog: vi.fn(),
  postBulkSync: vi.fn()
};

vi.mock('./useHabitsClient', () => ({
  useHabitsClient: () => mockClient
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: ref({ id: OWNER_ID }) })
}));

vi.mock('./useToast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('@vueuse/core', () => ({
  useNetwork: () => ({ isOnline: ref(true) })
}));

const d = (offset: number) => {
  const date = new Date(`${TODAY}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().split('T')[0]!;
};

const buildRemoteHabit = (): Habit => ({
  id: HABIT_ID,
  ownerId: OWNER_ID,
  title: 'Server Habit',
  description: '',
  skipsCount: 0,
  skipsPeriod: 'weekly',
  color: '#6366f1',
  sharedWith: [],
  currentStreak: 99,
  longestStreak: 99,
  streakAnchorDate: d(-1)
});

const buildRemoteLogs = (): HabitLog[] => {
  const logs: HabitLog[] = [];

  for (let offset = -60; offset <= -1; offset++) {
    logs.push({
      id: `${HABIT_ID}_${d(offset)}`,
      habitId: HABIT_ID,
      ownerId: OWNER_ID,
      date: d(offset),
      status: 'completed',
      sharedWith: [],
      streakCount: 99 + offset + 1,
      brokenStreakCount: 0
    });
  }

  return logs;
};

const buildRemoteBaseline = () => ({
  habitId: HABIT_ID,
  ownerId: OWNER_ID,
  startDate: d(-60),
  endDate: TODAY,
  baselineDate: d(-61),
  baselineCurrentStreak: 39,
  baselineLongestStreak: 39,
  baselineStreakAnchorDate: d(-61)
});

const buildRemoteBucket = (): Bucket => ({
  id: BUCKET_ID,
  ownerId: OWNER_ID,
  title: 'Server Bucket',
  description: '',
  color: '#6366f1',
  habitIds: [HABIT_ID],
  sharedHabits: [],
  currentStreak: 99,
  longestStreak: 99,
  streakAnchorDate: d(-1)
});

const buildRemoteBucketLogs = (): BucketLog[] => {
  const logs: BucketLog[] = [];

  for (let offset = -90; offset <= -1; offset++) {
    logs.push({
      id: `${BUCKET_ID}_${d(offset)}_${OWNER_ID}`,
      bucketId: BUCKET_ID,
      ownerId: OWNER_ID,
      date: d(offset),
      status: 'completed',
      streakCount: 99 + offset + 1,
      brokenStreakCount: 0
    });
  }

  return logs;
};

const buildRemoteBucketBaseline = () => ({
  bucketId: BUCKET_ID,
  ownerId: OWNER_ID,
  startDate: d(-90),
  endDate: TODAY,
  baselineDate: d(-91),
  baselineCurrentStreak: 9,
  baselineLongestStreak: 9,
  baselineStreakAnchorDate: d(-91)
});

describe('useHabitsApi - partial habit history sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('process', { client: true });
    _resetSyncState();

    await db.delete();
    await db.open();

    mockClient.postHabitLog.mockResolvedValue({ data: {} });
    mockClient.postBulkSync.mockResolvedValue({ success: [], failed: [] });
  });

  it('keeps a 99-day server streak at 100 after syncing only 60 history days and logging today', async () => {
    mockClient.fetchSync.mockResolvedValueOnce({
      habits: [buildRemoteHabit()],
      buckets: [],
      habitLogs: buildRemoteLogs(),
      bucketLogs: [],
      deletions: [],
      habitStreakBaselines: [buildRemoteBaseline()],
      serverTime: 10000,
      nextCursors: {},
      hasMore: false
    });

    const api = useHabitsApi();

    await api.sync();

    const syncedHabit = await db.habits.get(HABIT_ID);
    expect(syncedHabit?.currentStreak).toBe(99);

    const { habit } = await api.upsertLog({
      habitId: HABIT_ID,
      date: TODAY,
      status: 'completed'
    });

    expect(habit.currentStreak).toBe(100);
    expect(habit.longestStreak).toBe(100);
    expect(habit.streakAnchorDate).toBe(TODAY);
  });

  it('keeps a 99-day server bucket streak at 100 after syncing only 90 bucket history days and logging today', async () => {
    mockClient.fetchSync.mockResolvedValueOnce({
      habits: [buildRemoteHabit()],
      buckets: [buildRemoteBucket()],
      habitLogs: buildRemoteLogs(),
      bucketLogs: buildRemoteBucketLogs(),
      deletions: [],
      habitStreakBaselines: [buildRemoteBaseline()],
      bucketStreakBaselines: [buildRemoteBucketBaseline()],
      serverTime: 10000,
      nextCursors: {},
      hasMore: false
    });

    const api = useHabitsApi();

    await api.sync();

    const syncedBucket = await db.buckets.get(BUCKET_ID);
    expect(syncedBucket?.currentStreak).toBe(99);

    await api.upsertLog({
      habitId: HABIT_ID,
      date: TODAY,
      status: 'completed'
    });

    const updatedBucket = await db.buckets.get(BUCKET_ID);
    expect(updatedBucket?.currentStreak).toBe(100);
    expect(updatedBucket?.longestStreak).toBe(100);
    expect(updatedBucket?.streakAnchorDate).toBe(TODAY);
  });
});
