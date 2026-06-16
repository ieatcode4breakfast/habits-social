import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, integer, uuid, boolean, date, index, primaryKey, uniqueIndex, jsonb, check } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  photoUrl: text('photo_url'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    usersEmailUniqueIdx: uniqueIndex('users_email_unique_idx').on(sql`lower(${table.email})`),
    usersUsernameUniqueIdx: uniqueIndex('users_username_unique_idx').on(sql`lower(${table.username})`),
  };
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    passwordResetTokensHashIdx: uniqueIndex('password_reset_tokens_hash_idx').on(table.tokenHash),
    passwordResetTokensUserCreatedAtIdx: index('password_reset_tokens_user_created_at_idx').on(table.userId, table.createdAt),
  };
});

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
    habitLogsHabitOwnerDateIdx: index('habit_logs_habit_owner_date_idx').on(table.habitId, table.ownerId, table.date),
  };
});

export const buckets = pgTable('buckets', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  bucketId: uuid('bucket_id').notNull().references(() => buckets.id, { onDelete: 'cascade' }),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.bucketId, table.habitId] }),
  };
});

export const bucketLogs = pgTable('bucket_logs', {
  id: text('id').primaryKey(),
  bucketId: uuid('bucket_id').notNull().references(() => buckets.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  status: text('status').notNull(),
  streakCount: integer('streak_count').default(0),
  brokenStreakCount: integer('broken_streak_count').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    bucketLogsOwnerUpdatedAtIdIdx: index('bucket_logs_owner_updated_at_id_idx').on(table.ownerId, table.updatedAt, table.id),
    bucketLogsBucketOwnerDateIdx: index('bucket_logs_bucket_owner_date_idx').on(table.bucketId, table.ownerId, table.date),
  };
});

export const shareEvents = pgTable('share_events', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  initiatorId: uuid('initiator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: uuid('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  initiatorFavorite: boolean('initiator_favorite').default(false),
  receiverFavorite: boolean('receiver_favorite').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    friendshipsUserPairIdx: uniqueIndex('friendships_user_pair_idx').on(
      sql`LEAST(${table.initiatorId}, ${table.receiverId})`,
      sql`GREATEST(${table.initiatorId}, ${table.receiverId})`
    ),
  };
});

export const userBlocks = pgTable('user_blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.blockerId, table.blockedId] }),
    userBlocksBlockedBlockerIdx: index('user_blocks_blocked_blocker_idx').on(table.blockedId, table.blockerId),
    userBlocksNoSelfCheck: check('user_blocks_no_self_check', sql`${table.blockerId} <> ${table.blockedId}`),
  };
});

export const syncDeletions = pgTable('sync_deletions', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    syncDeletionsOwnerCreatedAtIdIdx: index('sync_deletions_owner_created_at_id_idx').on(table.ownerId, table.createdAt, table.id),
  };
});

export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').primaryKey(),
  user1Id: uuid('user1_id').references(() => users.id, { onDelete: 'set null' }),
  user2Id: uuid('user2_id').references(() => users.id, { onDelete: 'set null' }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    chatConversationsUserPairIdx: uniqueIndex('chat_conversations_user_pair_idx')
      .on(
        sql`LEAST(${table.user1Id}, ${table.user2Id})`,
        sql`GREATEST(${table.user1Id}, ${table.user2Id})`
      )
      .where(sql`${table.user1Id} IS NOT NULL AND ${table.user2Id} IS NOT NULL`),
    chatConversationsLastMessageAtIdx: index('chat_conversations_last_message_at_idx').on(table.lastMessageAt),
  };
});

export const chatParticipants = pgTable('chat_participants', {
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  };
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  expirationTime: timestamp('expiration_time', { withTimezone: true, mode: 'date' }),
  userAgent: text('user_agent'),
  disabledAt: timestamp('disabled_at', { withTimezone: true, mode: 'date' }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    pushSubscriptionsEndpointIdx: uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint),
    pushSubscriptionsDeliveryIdx: index('push_subscriptions_delivery_idx').on(table.userId, table.expirationTime, table.disabledAt, table.lastSeenAt),
  };
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  replyToActivity: jsonb('reply_to_activity'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => {
  return {
    chatMessagesConversationIdCreatedAtIdx: index('chat_messages_conversation_id_created_at_idx').on(table.conversationId, table.createdAt),
  };
});
