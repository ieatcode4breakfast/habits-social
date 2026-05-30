import Dexie, { type Table } from 'dexie';
import type { Habit, HabitLog, Bucket, BucketLog } from '../composables/useHabitsApi';
import type { BucketStreakBaseline, HabitStreakBaseline } from '../../server/types/sync';

// Extend the types to include local sync metadata
export interface LocalHabit extends Habit {
  synced: number; // 0 for no, 1 for yes
  updatedAt: number;
}

export interface LocalHabitLog extends HabitLog {
  synced: number;
  updatedAt: number;
}

export interface LocalBucket extends Bucket {
  synced: number;
  updatedAt: number;
}

export interface LocalBucketLog extends BucketLog {
  synced: number;
  updatedAt: number;
}

export interface LocalHabitStreakBaseline extends HabitStreakBaseline {
  updatedAt: number;
}

export interface LocalBucketStreakBaseline extends BucketStreakBaseline {
  updatedAt: number;
}

export class MyDatabase extends Dexie {
  habits!: Table<LocalHabit>;
  habitLogs!: Table<LocalHabitLog>;
  buckets!: Table<LocalBucket>;
  bucketLogs!: Table<LocalBucketLog>;
  habitStreakBaselines!: Table<LocalHabitStreakBaseline, string>;
  bucketStreakBaselines!: Table<LocalBucketStreakBaseline, string>;
  syncQueue!: Table<{ id?: number, type: string, action: string, payload: any }>;
  syncState!: Table<{ id: string, lastSynced: number, cursors: any, status?: string }>;

  constructor() {
    super('HabitsSocialDB');
    this.version(5).stores({
      habits: 'id, ownerId, synced, updatedAt',
      habitLogs: 'id, habitId, ownerId, date, synced, updatedAt',
      buckets: 'id, ownerId, synced, updatedAt',
      bucketLogs: 'id, bucketId, ownerId, date, synced, updatedAt',
      syncQueue: '++id, type, action',
      syncState: 'id'
    });
    this.version(6).stores({
      habits: 'id, ownerId, synced, updatedAt',
      habitLogs: 'id, habitId, ownerId, date, synced, updatedAt',
      buckets: 'id, ownerId, synced, updatedAt',
      bucketLogs: 'id, bucketId, ownerId, date, synced, updatedAt',
      habitStreakBaselines: 'habitId, ownerId, startDate, endDate',
      bucketStreakBaselines: 'bucketId, ownerId, startDate, endDate',
      syncQueue: '++id, type, action',
      syncState: 'id'
    });
    this.version(7).stores({
      habits: 'id, ownerId, synced, updatedAt',
      habitLogs: 'id, habitId, ownerId, date, synced, updatedAt',
      buckets: 'id, ownerId, synced, updatedAt',
      bucketLogs: 'id, bucketId, ownerId, date, synced, updatedAt',
      habitStreakBaselines: 'habitId, ownerId, startDate, endDate',
      bucketStreakBaselines: 'bucketId, ownerId, startDate, endDate',
      syncQueue: '++id, type, action',
      syncState: 'id'
    });
  }
}

export const db = new MyDatabase();
