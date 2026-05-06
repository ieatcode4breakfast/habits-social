import Dexie, { type Table } from 'dexie';
import type { Habit, HabitLog, Bucket, BucketLog } from '~/composables/useHabitsApi';

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

export class MyDatabase extends Dexie {
  habits!: Table<LocalHabit>;
  habitLogs!: Table<LocalHabitLog>;
  buckets!: Table<LocalBucket>;
  bucketLogs!: Table<LocalBucketLog>;
  syncQueue!: Table<{ id?: number, type: string, action: string, payload: any }>;

  constructor() {
    super('HabitsSocialDB');
    this.version(4).stores({
      habits: 'id, ownerId, synced, updatedAt',
      habitLogs: 'id, habitId, ownerId, date, synced, updatedAt',
      buckets: 'id, ownerId, synced, updatedAt',
      bucketLogs: 'id, bucketId, ownerId, date, synced, updatedAt',
      syncQueue: '++id, type, action'
    });
  }
}

export const db = new MyDatabase();
