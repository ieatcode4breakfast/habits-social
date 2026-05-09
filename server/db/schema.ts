import { pgTable, text, timestamp, integer, uuid, boolean, date, index, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  photoUrl: text('photo_url'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  skipsCount: integer('skips_count').default(0),
  skipsPeriod: text('skips_period').default('daily'),
  color: text('color'),
  sharedWith: text('shared_with').array(),
  sortOrder: integer('sort_order').default(0),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  streakAnchorDate: date('streak_anchor_date'),
  userDate: text('user_date'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    habitsOwnerUpdatedAtIdIdx: index('habits_owner_updated_at_id_idx').on(table.ownerId, table.updatedAt, table.id),
    habitsFeedPaginationIdx: index('habits_feed_pagination_idx').on(table.ownerId, table.userDate, table.createdAt, table.id),
  };
});

export const habitLogs = pgTable('habit_logs', {
  id: text('id').primaryKey(),
  habitId: uuid('habit_id').notNull(),
  ownerId: text('owner_id').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  streakCount: integer('streak_count').default(0),
  brokenStreakCount: integer('broken_streak_count').default(0),
  sharedWith: text('shared_with').array(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    habitLogsOwnerUpdatedAtIdIdx: index('habit_logs_owner_updated_at_id_idx').on(table.ownerId, table.updatedAt, table.id),
    habitLogsFeedPaginationIdx: index('habit_logs_feed_pagination_idx').on(table.ownerId, table.date, table.updatedAt, table.id),
  };
});

export const buckets = pgTable('buckets', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  color: text('color'),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  streakAnchorDate: date('streak_anchor_date'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    bucketsOwnerUpdatedAtIdIdx: index('buckets_owner_updated_at_id_idx').on(table.ownerId, table.updatedAt, table.id),
  };
});

export const bucketHabits = pgTable('bucket_habits', {
  bucketId: uuid('bucket_id').notNull(),
  habitId: uuid('habit_id').notNull(),
  addedBy: uuid('added_by'),
  approvalStatus: text('approval_status').default('approved'),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.bucketId, table.habitId] }),
  };
});

export const sharedBucketMembers = pgTable('shared_bucket_members', {
  bucketId: uuid('bucket_id').notNull(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const bucketLogs = pgTable('bucket_logs', {
  id: text('id').primaryKey(),
  bucketId: uuid('bucket_id').notNull(),
  ownerId: text('owner_id').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  streakCount: integer('streak_count').default(0),
  brokenStreakCount: integer('broken_streak_count').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    bucketLogsOwnerUpdatedAtIdIdx: index('bucket_logs_owner_updated_at_id_idx').on(table.ownerId, table.updatedAt, table.id),
  };
});

export const shareEvents = pgTable('share_events', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  habitIds: text('habit_ids').array().notNull(),
  userDate: text('user_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    shareEventsFeedPaginationIdx: index('share_events_feed_pagination_idx').on(table.ownerId, table.userDate, table.createdAt, table.id),
  };
});

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey(),
  initiatorId: text('initiator_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  status: text('status').notNull(),
  initiatorFavorite: boolean('initiator_favorite').default(false),
  receiverFavorite: boolean('receiver_favorite').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
});

export const syncDeletions = pgTable('sync_deletions', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    syncDeletionsOwnerCreatedAtIdIdx: index('sync_deletions_owner_created_at_id_idx').on(table.ownerId, table.createdAt, table.id),
  };
});
