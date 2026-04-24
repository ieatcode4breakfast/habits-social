import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  photourl: text('photourl'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description').default(''),
  frequencyCount: integer('frequency_count').default(1),
  frequencyPeriod: text('frequency_period', { enum: ['daily', 'weekly', 'monthly'] }).default('daily'),
  color: text('color').default('#6366f1'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const habitShares = sqliteTable('habit_shares', {
  habitId: integer('habit_id').notNull().references(() => habits.id),
  userId: integer('user_id').notNull().references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.habitId, t.userId] }),
}));

export const habitLogs = sqliteTable('habit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  date: text('date').notNull(), // stored as YYYY-MM-DD
  status: text('status', { enum: ['completed', 'skipped', 'failed'] }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const habitLogShares = sqliteTable('habit_log_shares', {
  habitLogId: integer('habit_log_id').notNull().references(() => habitLogs.id),
  userId: integer('user_id').notNull().references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.habitLogId, t.userId] }),
}));

export const friendships = sqliteTable('friendships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  initiatorId: integer('initiator_id').notNull().references(() => users.id),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'accepted'] }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
