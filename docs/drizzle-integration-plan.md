# Exhaustive Drizzle ORM Integration Execution Guide

This document is a paint-by-numbers guide for the AI Agent executing the Drizzle ORM integration for Habits Social. 

**Core Objective:** Complete a "Big Bang" migration, replacing all raw SQL calls via `@neondatabase/serverless` with strictly typed `drizzle-orm` queries across the entire `server/` directory.

---

## Phase 1: Installation and Basic Configuration

**1. Install Dependencies**
Execute the following commands in the workspace root:
```bash
npm install drizzle-orm drizzle-zod @neondatabase/serverless
npm install -D drizzle-kit
```

**2. Configure Drizzle Kit**
Create the file `drizzle.config.ts` in the workspace root with exactly this content:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.NUXT_DATABASE_URL || '',
  },
});
```

---

## Phase 2: Single Source of Truth Schema (`server/db/schema.ts`)

Create `server/db/schema.ts`. Copy-paste the code below exactly. This code maps the PostgreSQL database `snake_case` or lowercase columns to the application's `camelCase` keys.

```typescript
import { pgTable, text, timestamp, integer, uuid, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  passwordHash: text('passwordhash').notNull(),
  photoUrl: text('photourl'),
  emailVerifiedAt: timestamp('emailverifiedat', { mode: 'date' }),
  createdAt: timestamp('createdat', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('ownerid').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  skipsCount: integer('skipscount').notNull(),
  skipsPeriod: text('skipsperiod').notNull(),
  color: text('color').notNull(),
  sharedWith: jsonb('sharedwith').$type<string[]>(),
  sortOrder: integer('sortorder').notNull(),
  currentStreak: integer('currentstreak').default(0),
  longestStreak: integer('longeststreak').default(0),
  streakAnchorDate: timestamp('streakanchordate', { mode: 'date' }),
  userDate: text('user_date'),
  createdAt: timestamp('createdat', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const habitLogs = pgTable('habitlogs', {
  id: text('id').primaryKey(), // Composite id string (e.g. habitid_date)
  habitId: uuid('habitid').notNull(),
  ownerId: uuid('ownerid').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  streakCount: integer('streakcount').notNull(),
  brokenStreakCount: integer('brokenstreakcount'),
  sharedWith: jsonb('sharedwith').$type<string[]>(),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const buckets = pgTable('buckets', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('ownerid').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  color: text('color'),
  currentStreak: integer('currentstreak').default(0),
  longestStreak: integer('longeststreak').default(0),
  streakAnchorDate: timestamp('streakanchordate', { mode: 'date' }),
  sortOrder: integer('sortorder').notNull(),
  createdAt: timestamp('createdat', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const bucketHabits = pgTable('buckethabits', {
  bucketId: uuid('bucket_id').notNull(),
  habitId: uuid('habit_id').notNull(),
  addedBy: uuid('added_by').notNull(),
  approvalStatus: text('approval_status').notNull(),
}); // In production, add composite primary key if needed.

export const sharedBucketMembers = pgTable('sharedbucketmembers', {
  bucketId: uuid('bucket_id').notNull(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const bucketLogs = pgTable('bucketlogs', {
  id: text('id').primaryKey(),
  bucketId: uuid('bucketid').notNull(),
  ownerId: uuid('ownerid').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  streakCount: integer('streakcount').notNull(),
  brokenStreakCount: integer('brokenstreakcount'),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const shareEvents = pgTable('shareevents', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('ownerid').notNull(),
  recipientId: uuid('recipientid').notNull(),
  habitIds: jsonb('habitids').$type<string[]>(),
  userDate: text('user_date'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey(),
  initiatorId: uuid('initiatorid').notNull(),
  receiverId: uuid('receiverid').notNull(),
  status: text('status').notNull(), // 'pending' | 'accepted'
  initiatorFavorite: boolean('initiatorfavorite').default(false),
  receiverFavorite: boolean('receiverfavorite').default(false),
  createdAt: timestamp('createdat', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedat', { mode: 'date' }).defaultNow().notNull(),
});

export const syncDeletions = pgTable('syncdeletions', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('ownerid').notNull(),
  entityId: uuid('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
```

---

## Phase 3: Update `server/utils/db.ts`

Replace the entire contents of `server/utils/db.ts` with:

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import type { H3Event } from 'h3';

export const useDB = (event?: H3Event) => {
  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {
    // Fallback for tests or environments
  }

  const cf = (event as any)?.context?.cloudflare;
  
  const uri = (config.databaseUrl as string)
    || cf?.env?.DATABASE_URL
    || cf?.env?.NUXT_DATABASE_URL
    || process.env.DATABASE_URL
    || process.env.NUXT_DATABASE_URL;

  if (!uri) {
    console.error('DATABASE_URL is missing.');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  const sql = neon(uri);
  return drizzle(sql, { schema });
};
```
*Note: The old `wrappedSql` and `toCamelCase` function usages are completely removed because Drizzle handles naming natively via the schema definition.*

---

## Phase 4: Zod Validation and TypeScript Types Generation

**1. Create/Update `server/utils/validation.ts`**
Replace custom schemas with Drizzle-Zod generated schemas.
```typescript
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import * as schema from '../db/schema';

// Export Select Schemas
export const selectUserSchema = createSelectSchema(schema.users);
export const selectHabitSchema = createSelectSchema(schema.habits);
export const selectHabitLogSchema = createSelectSchema(schema.habitLogs);
export const selectBucketSchema = createSelectSchema(schema.buckets);

// Export Insert Schemas
export const insertUserSchema = createInsertSchema(schema.users);
export const insertHabitSchema = createInsertSchema(schema.habits);
// ... generate for the rest as needed by endpoints
```

**2. Update `types/index.ts`**
Remove manually typed interfaces (e.g. `export interface Habit { ... }`) and replace them with inferences from Drizzle:
```typescript
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
```

---

## Phase 5: Endpoint Migration Checklist

The following 25+ files in `server/api/` MUST be updated. You will replace `await sql\`...\`` with Drizzle builder syntax (`await db.select().from(...)`).

**Important Drizzle Query Rules:**
1. **Never use the `sql` template literal for full queries anymore.** Use it only for raw expressions inside Drizzle builders if absolutely necessary (e.g., `sql\`COUNT(*)\``).
2. **Returning Data:** When inserting/updating, append `.returning()` to get the result. Example: `await db.insert(schema.habits).values(data).returning();`
3. **Array Results:** Note that `db.select()...` always returns an array. For singular queries, you must extract the first item: `const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));`

### Exhaustive File List:

**Auth:**
- [ ] `server/api/auth/login.post.ts`
- [ ] `server/api/auth/logout.post.ts`
- [ ] `server/api/auth/me.get.ts`
- [ ] `server/api/auth/register.post.ts`

**Users:**
- [ ] `server/api/users/me.delete.ts`
- [ ] `server/api/users/me.get.ts`
- [ ] `server/api/users/me.put.ts`
- [ ] `server/api/users/search.get.ts`
- [ ] `server/api/users/[id]/profile.get.ts`

**Habits & Logs:**
- [ ] `server/api/habits/[id].ts`
- [ ] `server/api/habits/index.ts`
- [ ] `server/api/habits/reorder.ts`
- [ ] `server/api/habitlogs/index.ts`

**Buckets & Logs:**
- [ ] `server/api/buckets/[id].ts`
- [ ] `server/api/buckets/index.ts`
- [ ] `server/api/buckets/reorder.ts`
- [ ] `server/api/bucketlogs/index.ts`

**Friendships & Social:**
- [ ] `server/api/friendships/[id].ts`
- [ ] `server/api/friendships/favorite.put.ts`
- [ ] `server/api/friendships/index.ts`
- [ ] `server/api/social/feed.get.ts`
- [ ] `server/api/social/friend-data.get.ts`
- [ ] `server/api/social/habit-details.get.ts`
- [ ] `server/api/social/share-habits.post.ts`

**Sync:**
- [ ] `server/api/sync.get.ts`

### Example Migration Transformation

**BEFORE (Raw SQL):**
```typescript
// server/api/habits/index.ts
import { useDB as _useDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const sql = useDB(event);
  const userId = event.context.user.id;

  const habits = await sql`SELECT * FROM habits WHERE ownerid = ${userId} ORDER BY sortorder ASC`;
  return habits;
});
```

**AFTER (Drizzle ORM):**
```typescript
// server/api/habits/index.ts
import { useDB as _useDB } from '~~/server/utils/db';
import { eq, asc } from 'drizzle-orm';
import { habits } from '~~/server/db/schema';

export default defineEventHandler(async (event) => {
  const useDB = (event.context as any).useDB || _useDB;
  const db = useDB(event);
  const userId = event.context.user.id;

  const results = await db.select()
    .from(habits)
    .where(eq(habits.ownerId, userId))
    .orderBy(asc(habits.sortOrder));
    
  return results;
});
```

---

## Phase 6: Testing & QA

After rewriting all the files:
1. **Type Check:** Run `npx tsc --noEmit` to verify type safety across all files (including Nuxt UI components). Fix any mismatching imports or incorrect `any` assignments.
2. **Unit Tests:** Execute `npm run test`. Ensure all tests under `server/tests/*.spec.ts` pass.
   - *Note: Since tests mock `useDB`, ensure `server/tests/setup.ts` correctly provides the Drizzle mock instead of the raw `sql` mock if necessary.*
3. **E2E Tests:** Execute `npm run test:e2e` to verify full system behavior.

**Revert Strategy:**
If catastrophic failures occur, do a `git reset --hard` to roll back to the raw SQL implementation. No database data changes are being applied, so no database rollbacks are needed.