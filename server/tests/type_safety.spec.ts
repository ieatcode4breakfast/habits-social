import { describe, test, expectTypeOf } from 'vitest';
import { useDB } from '../utils/db';
import { SyncService } from '../services/sync.service';
import { HabitService } from '../services/habit.service';
import { BucketService } from '../services/bucket.service';

describe('Database Type Safety and Philosophy Guard', () => {
  test('useDB utility return type must NOT fallback to any', () => {
    expectTypeOf(useDB).returns.not.toBeAny();
  });

  test('SyncService database parameters must reject any', () => {
    expectTypeOf(SyncService.getDeltas).parameter(0).not.toBeAny();
    expectTypeOf(SyncService.getPaginatedDeltas).parameter(0).not.toBeAny();
  });

  test('HabitService database parameters must reject any', () => {
    expectTypeOf(HabitService.createHabit).parameter(0).not.toBeAny();
    expectTypeOf(HabitService.logHabit).parameter(0).not.toBeAny();
  });

  test('BucketService database parameters must reject any', () => {
    expectTypeOf(BucketService.logBucket).parameter(0).not.toBeAny();
  });
});
