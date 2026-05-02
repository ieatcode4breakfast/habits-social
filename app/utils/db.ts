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

  constructor() {
    super('HabitsSocialDB');
    this.version(1).stores({
      habits: 'id, ownerid, synced, updatedAt',
      habitLogs: 'id, habitid, ownerid, date, synced, updatedAt',
      buckets: 'id, ownerid, synced, updatedAt',
      bucketLogs: 'id, bucketid, ownerid, date, synced, updatedAt'
    });
  }
}

export const db = new MyDatabase();
