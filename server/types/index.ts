import * as schema from '~~/server/db/schema';

export type User = typeof schema.users.$inferSelect;
export type Habit = typeof schema.habits.$inferSelect;
export type HabitLog = typeof schema.habitLogs.$inferSelect;
export type Bucket = typeof schema.buckets.$inferSelect;
export type BucketHabit = typeof schema.bucketHabits.$inferSelect;
export type SharedBucketMember = typeof schema.sharedBucketMembers.$inferSelect;
export type BucketLog = typeof schema.bucketLogs.$inferSelect;
export type ShareEvent = typeof schema.shareEvents.$inferSelect;
export type Friendship = typeof schema.friendships.$inferSelect;
export type SyncDeletion = typeof schema.syncDeletions.$inferSelect;

export type NewHabit = typeof schema.habits.$inferInsert;
export type NewUser = typeof schema.users.$inferInsert;
export type NewHabitLog = typeof schema.habitLogs.$inferInsert;
export type NewBucketLog = typeof schema.bucketLogs.$inferInsert;

// Maintain I-prefixes for temporary compatibility if needed, but the project seems to use them heavily.
// I'll check if I should keep them. The current file uses IUser, IHabit, etc.
// I will map the I-prefixed ones to the new types to avoid breaking the frontend immediately.
export type IUser = User;
export type IHabit = Habit;
export type IHabitLog = HabitLog;
export type IBucket = Bucket;
export type IBucketLog = BucketLog;
export type IFriendship = Friendship;
export type IShareEvent = ShareEvent;
export type ISyncDeletion = SyncDeletion;

