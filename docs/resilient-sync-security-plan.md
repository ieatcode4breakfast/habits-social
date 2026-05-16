# Zero-Toil Resilient Sync & Security Architecture — Implementation Plan V2.2

> **Status**: Approved for implementation  
> **Last Updated**: 2026-05-15  
> **Phases**: 3 (sequential)  
> **Prerequisite Reading**: `docs/data-flow-and-sync-standard.md`, `docs/streak-logic.md`

## Implemented So Far

### Phase 1: Schema Hardening & Centralization
- **Created** `server/utils/schemaPrimitives.ts` containing centralized Zod primitives (`zId`, `zShortText`, `zLongText`, `zColor`, `zDateString`, `zStandardArray`, `zPassword`, `zLoginPassword`).
- **Refactored** `server/utils/validation.ts` to use these primitives across schemas:
  - Fixed CPU DoS on `loginSchema` by adding `max(72)` to password.
  - Applied bounds to `habitSchema`, `bucketSchema`, `habitLogSchema`, `bucketLogSchema`, `shareHabitsSchema`, `habitReorderSchema`, and `bucketReorderSchema`.
- **Added Tests** in `server/tests/validation.schema.spec.ts` for:
  - `loginSchema` password length limit.
  - `habitSchema` `sharedWith` array limit.
- **Verified** that all 61 test files and 212 tests pass successfully.

### Phase 2: Payload Minimization in One-by-One Sync
- **Stripped derived streak fields** from client payloads in `useHabitsApi.ts` to reduce bandwidth.
- **Updated server Zod schemas** in `validation.ts` to omit derived fields on input.
- **Removed streak mapping** in `habit.service.ts` and `bucket.service.ts` to prevent overwriting server calculations.
- **Added tests** in `useHabitsApi.payload.spec.ts` and `validation.schema.spec.ts`.

### Phase 2.1: Habit Limit Enforcement
- **Added a strict limit of 30 habits** per user in `HabitService.createHabit` to prevent DB bloat.
- **Created test file** `habits.limit.spec.ts` to verify the limit (TDD approach).

### Phase 3: Improved Limit Enforcement & Toasts
- **Refactored limit checks** in `habit.service.ts` and `server/api/buckets/index.ts` to lock the parent user record (`FOR UPDATE`) to serialize operations and strictly enforce quotas.
- **Allowed updates** to existing habits and buckets even when the user is at the limit (30 habits / 50 buckets).
- **Added structured error codes** (`HABIT_LIMIT_REACHED` and `BUCKET_LIMIT_REACHED`) in backend responses.
- **Implemented specific toasts** in the frontend (`useHabitsApi.ts`) to inform users when sync fails due to limits.
- **Added unit tests** in `buckets.limit.spec.ts` and updated `useHabitsApi.payload.spec.ts` to verify these behaviors.

---




## Table of Contents

1. [Project Context & Current State](#1-project-context--current-state)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Phase 1: Infrastructure Security](#3-phase-1-infrastructure-security)
4. [Phase 2: Batch Synchronization](#4-phase-2-batch-synchronization)
5. [Phase 3: Persistent Background Cascades](#5-phase-3-persistent-background-cascades)
6. [TDD Execution Workflow](#6-tdd-execution-workflow)
7. [Verification Plan](#7-verification-plan)
8. [Risk Register](#8-risk-register)
9. [File Change Summary](#9-file-change-summary)

---

## 1. Project Context & Current State

### 1.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Nuxt | ^4.4.2 |
| Deployment | Cloudflare Workers | `cloudflare-module` Nitro preset |
| Database | PostgreSQL (Neon Serverless) | `@neondatabase/serverless@^1.1.0` |
| ORM | Drizzle ORM | ^0.45.2 |
| Migrations | Drizzle Kit | ^0.31.10 |
| Validation | Zod v4 | ^4.4.2 |
| Drizzle-Zod | drizzle-zod | ^0.8.3 |
| Client Storage | Dexie.js (IndexedDB) | ^4.4.2 |
| Real-Time | Pusher (server + client) | ^5.3.3 / ^8.5.0 |
| Auth | JWT via jose, bcrypt-ts | ^6.0.0 / ^5.0.3 |
| Testing | Vitest (against real Neon DB) | ^4.1.5 |
| Rate Limiting | Cloudflare KV (`AUTH_KV`) | — |

### 1.2 Deployment Configuration

- **Environments**: Staging (`habits-social-staging`) and Production (`habits-social-live`) in `wrangler.toml`.
- **Compatibility**: `nodejs_compat` flag, date `2024-11-01`.
- **KV Bindings**: `AUTH_KV` bound in both environments for rate limiting.
- **No existing cron triggers** in `wrangler.toml`.
- **No existing Nitro tasks, plugins, or scheduled handlers** in the codebase.

### 1.3 Current Sync Architecture

| Aspect | Current State | Problem |
|--------|--------------|---------|
| **Pull** | V2 cursor-based paginated via `GET /api/v2/sync` | Working well, no changes needed |
| **Push** | Individual HTTP requests per entity in a `for...of` loop (`useHabitsApi.ts` lines ~432-523) | O(N) requests for N offline changes. Slow reconnection. |
| **Streaks** | Always inline within request DB transactions (`recalculateHabitStreak()` called inside every log create/delete) | Acceptable for single items. Unacceptable for batch reconciliation of N items. |
| **Pusher** | Fire-and-forget (never awaited, never wrapped in `waitUntil`) | Notifications silently dropped when Worker isolate terminates before HTTP call completes. |
| **Background Processing** | None. No `waitUntil`, no cron, no tasks. | No safety net for deferred work. |
| **Body Size Limits** | None configured. Cloudflare platform limit is 100MB (paid). | Memory exhaustion / DoS via oversized payloads. |
| **Login Password** | `loginSchema.password` has `min(1)` with no max. | CPU DoS via multi-MB password sent to bcrypt. Uniform `max(72)` will be applied (no existing users exceed this). |

### 1.4 Current Database Schema (Relevant Tables)

```
users           → id (uuid PK), email, username, passwordHash, photoUrl, timestamps
habits          → id (uuid PK), ownerId (FK→users), title, description, skipsCount,
                  skipsPeriod, color, sharedWith (text[]), sortOrder, currentStreak,
                  longestStreak, streakAnchorDate, userDate, timestamps
habitLogs       → id (text PK, format "{habitId}_{date}"), habitId (FK→habits),
                  ownerId (FK→users), date (text), status, streakCount,
                  brokenStreakCount, sharedWith (text[]), updatedAt
buckets         → id (uuid PK), ownerId (FK→users), title, description, color,
                  currentStreak, longestStreak, streakAnchorDate, sortOrder, timestamps
bucketLogs      → id (text PK), bucketId (FK→buckets), ownerId (FK→users), date,
                  status, streakCount, brokenStreakCount, updatedAt
bucketHabits    → (bucketId, habitId) composite PK, addedBy (FK→users), approvalStatus
syncDeletions   → id (uuid PK), ownerId (FK→users), entityId, entityType, createdAt
```

### 1.5 Current Validation Schemas (`server/utils/validation.ts`)

| Schema | Password Rule | Bound Limits |
|--------|--------------|-------------|
| `registerSchema` | `min(8).max(72)` | Correct for registration |
| `loginSchema` | `min(1)` — **no max** | Vulnerable to CPU DoS |
| `updateProfileSchema` | `min(8).max(72)` optional | Correct |
| `insertUserSchema.passwordHash` | `min(8).max(72)` | Validates hash string, not plaintext |
| `habitSchema.title` | — | `min(1).max(255)` inline |
| `habitSchema.description` | — | `max(2000)` inline |
| `habitSchema.sharedWith` | — | `z.array(z.string().uuid())` **unbounded** |
| `habitReorderSchema.ids` | — | `max(30)` |
| `bucketReorderSchema.ids` | — | `max(50)` |

No shared primitives exist. Each schema defines its own bounds independently.

### 1.6 Current Test Infrastructure

- **53 test files** in `server/tests/`.
- **Real DB**: Tests run against a real Neon PostgreSQL database (not mocked).
- **Mock Events**: `createMockEvent()` in `test.utils.ts` creates fake H3 events. These **bypass all server middleware** — they go directly to route handlers.
- **Auth Mock**: `requireAuth` returns `event.context.userId` (set by the test). Cookie `auth_token: 'invalid'` triggers 401.
- **Service Tests**: Import service functions directly and call them with the test DB instance.
- **Setup**: `server/tests/setup.ts` stubs all Nuxt auto-imports (`useRuntimeConfig`, `readBody`, `createError`, `getQuery`, etc.).

### 1.7 Existing `onConflictDoUpdate` Usage

The upsert pattern is well-established across the codebase:

| File | Context |
|------|---------|
| `habit.service.ts` | `logHabit` — upsert `habitLogs` on `habitLogs.id`, guarded by `ownerId` |
| `habit.service.ts` | `createHabit` — upsert `habitsTable` on `habitsTable.id`, guarded by `ownerId` |
| `bucket.service.ts` | `logBucket` — upsert `bucketLogs` on `bucketLogs.id`, guarded by `ownerId` |
| `bucket.service.ts` | `updateBucket` — upsert `bucketHabits` on composite PK |
| `api/buckets/index.ts` | POST — upsert `bucketsTable` on `bucketsTable.id` |

### 1.8 DB Connection Model (`server/utils/db.ts`)

- Uses Neon Serverless `Pool` with Drizzle ORM.
- **Production (Cloudflare):** `neonConfig.useFetch = true` (stateless HTTP queries for Workers I/O safety). A new Pool is created per request-scope to avoid cross-request I/O context leakage. The Drizzle instance is cached on `event.context._db` for the duration of a single request.
- **Dev/Test:** `useFetch = false` (WebSockets). Global singleton pool cached in `cachedPool`/`cachedDb`.
- **Transactions:** Standard Drizzle `db.transaction()` is supported. Neon's HTTP mode handles transactions correctly.
- **Background/No-event:** When no `event` is passed (e.g., cron tasks), falls back to the global singleton pool.

---

## 2. Architecture Decisions

### AD-1: Optimistic UI Dependency
The client uses Optimistic UI for immediate user feedback. All user interactions settle in the local Dexie database before any network request. Server-side cascades (streaks, notifications) are handled asynchronously after the response is sent. See `docs/data-flow-and-sync-standard.md` Section 1.

### AD-2: Dual Cascade Strategy — Individual vs. Batch
- **Individual endpoints** (`POST /api/habits`, `POST /api/habitlogs`, etc.) **retain inline streak calculation**. These serve real-time UI interactions (creating/logging one item). The per-item cost is low (~1 streak recalc query) and the inline behavior ensures immediate consistency.
- **Batch endpoint** (`POST /api/v2/sync/batch`) **defers cascades** via the `cascadeVersion` dirty counter. This serves offline reconciliation (syncing N changes). Running N inline streak recalculations would be O(N) expensive and would block the response.
- **Rationale**: Different interaction profiles warrant different cascade strategies. The individual endpoints are not deprecated — they continue to serve direct UI actions.

### AD-3: Version Counter Over Boolean Flag
The `userSyncStates.cascadeVersion` field is an integer counter, not a boolean. Each batch sync increments the counter. The cascade processor captures the current version before executing, then uses an atomic compare-and-swap (`UPDATE ... WHERE cascade_version = <captured>`) to reset it. If the version changed during processing (another sync arrived), the reset affects 0 rows — the row stays dirty for the next pass. This prevents lost concurrent sync signals that a boolean flag would swallow.

### AD-4: Body Size Enforcement via Middleware, Not Route Rules
Nitro's `routeRules` support `headers`, `redirect`, `cache`, `cors`, `proxy`, and `prerender`. There is **no `maxBodySize` property** in the route rules specification. Placing a made-up property there would be silently ignored by the framework, leaving the API completely unprotected while appearing secured in config. Body size limits are enforced via a custom Nitro server middleware that inspects `Content-Length` headers and measured body size.

### AD-5: `waitUntil` API Path on Cloudflare Workers
On the `cloudflare-module` Nitro preset, the `waitUntil` function is accessed at:
```
event.context.cloudflare.context.waitUntil(promise)
```
**Not** `event.waitUntil`. Using the wrong path means the promise is never registered with the Workers runtime. The isolate terminates after the response is sent, and the background work silently dies. A `useWaitUntil(event, promise)` utility abstracts this with a dev/test fallback.

### AD-6: Cloudflare Cron Requires Dual Configuration
Nitro scheduled tasks require **both**:
1. `nuxt.config.ts` → `nitro.experimental.tasks = true` + `nitro.scheduledTasks` mapping.
2. `wrangler.toml` → `[triggers] crons = ["* * * * *"]` in each environment.

Without both sides, the Worker never receives the `scheduled` event from Cloudflare's edge, and the cron safety net never executes.

### AD-7: Bounded Cron Processing
Cloudflare Workers cron triggers have a 30-second CPU time limit. The cascade cron processes at most 50 dirty users per invocation (ordered by oldest `lastCascadeAt`). Any remaining dirty users are caught by the next 60-second pass.

### AD-8: Uniform 72-Char Password Limit
bcrypt truncates input at 72 bytes. Any password longer than 72 chars is silently reduced before hashing, meaning the extra characters provide zero security value. To prevent CPU DoS via multi-MB passwords sent to bcrypt and to enforce honest security expectations, a strict `max(72)` limit is applied uniformly across **all** auth endpoints (Registration, Login, Reset, and Profile Update). There are no existing users with passwords exceeding 72 characters, so this introduces no backward compatibility risk.

---

## 3. Phase 1: Infrastructure Security

**Objective**: Harden the API against memory exhaustion, input-based attacks, and password-related DoS vectors.

---



### 3.3 [NEW] `server/middleware/bodyLimit.ts`

Create a Nitro server middleware that enforces request body size limits.

**Route Limit Map:**
```
ROUTE_LIMITS = {
  '/api/v2/sync/batch': 256_000    // 250 KB for batch sync
}
DEFAULT_LIMIT = 102_400              // 100 KB for everything else
```

**Logic:**
1. **Method filter**: Only apply to `POST`, `PUT`, `PATCH`. Skip `GET`, `DELETE`, `HEAD`, `OPTIONS`.
2. **Route matching**: Match `event.path` against `ROUTE_LIMITS` keys (startsWith or exact match). Fall back to `DEFAULT_LIMIT`.
3. **Fast path (Content-Length header)**: Parse the `Content-Length` header as an integer. If present and exceeds the matched limit, throw `createError({ statusCode: 413, statusMessage: 'Payload Too Large' })`. This rejects oversized requests before body parsing touches memory.
4. **Fallback (no Content-Length)**: For chunked transfers or missing headers, call `readRawBody(event)`. If the returned buffer's byte length exceeds the limit, throw 413. If the body was already read, cache it on the event context so downstream handlers don't re-read.

**Why middleware, not route rules**: See AD-4. Nitro `routeRules` do not support `maxBodySize`. This would be silently ignored.

---

### 3.4 Phase 1 Tests

#### [NEW] `server/tests/security.bodylimit.spec.ts`

Test the middleware function in isolation. `createMockEvent()` bypasses middleware, so we import and call the middleware handler directly.

| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | POST `/api/habits` with `Content-Length: 150000` | Mock event with header | 413 Payload Too Large |
| 2 | POST `/api/habits` with `Content-Length: 50000` | Mock event with header | Passes through (no error) |
| 3 | POST `/api/v2/sync/batch` with `Content-Length: 200000` | Mock event with header | Passes through (under 250KB) |
| 4 | POST `/api/v2/sync/batch` with `Content-Length: 300000` | Mock event with header | 413 Payload Too Large |
| 5 | GET request with `Content-Length: 200000` | Mock event, GET method | Passes through (GET exempt) |
| 6 | POST without `Content-Length`, body >100KB | Mock event with large body | 413 Payload Too Large |
| 7 | POST without `Content-Length`, body <100KB | Mock event with small body | Passes through |



## 4. Phase 2: Batch Synchronization

**Objective**: Replace individual-push sync with a transactional batched push model for offline reconciliation. Achieve atomicity, idempotency, and parameter safety.

**Dependency**: Phase 1 must be complete (`schemaPrimitives.ts` exists, `userSyncStates` table added).

---

### 4.1 [MODIFY] `server/db/schema.ts`

Add the `userSyncStates` table:

```typescript
export const userSyncStates = pgTable('user_sync_states', {
  userId:         uuid('user_id')
                    .primaryKey()
                    .references(() => users.id, { onDelete: 'cascade' }),
  cascadeVersion: integer('cascade_version').notNull().default(0),
  lastCascadeAt:  timestamp('last_cascade_at', { withTimezone: true }),
})
```

**Migration steps (must be performed before Phase 2 tests can run):**
1. Run `npx drizzle-kit generate` — produces a new migration SQL file in `server/db/migrations/`.
2. Review the generated SQL. Confirm it creates `user_sync_states` with the correct columns, PK, and FK.
3. Apply to staging: `npx drizzle-kit push` (or the project's standard migration workflow).
4. Apply to production after staging verification.

---

### 4.2 [NEW] `server/api/v2/sync/batch.post.ts`

Create a batch sync endpoint at `POST /api/v2/sync/batch`.

#### Request Schema

```typescript
const batchSyncSchema = z.object({
  habits:     zStandardArray(habitSchema).default([]),
  habitLogs:  zStandardArray(
    habitLogSchema.extend({ id: z.string(), habitId: zId })
  ).default([]),
  buckets:    zStandardArray(bucketSchema).default([]),
  bucketLogs: zStandardArray(
    bucketLogSchema.extend({ id: z.string(), bucketId: zId })
  ).default([]),
  deletions:  zStandardArray(z.object({
    entityId:   z.string(),
    entityType: z.enum(['habit', 'habitLog', 'bucket', 'bucketLog']),
  })).default([]),
})
```

Each entity array is capped at 100 items via `zStandardArray`. Worst-case parameter count for a fully-loaded batch: `(100 habits x ~12 cols) + (100 habitLogs x ~8 cols) + (100 buckets x ~12 cols) + (100 bucketLogs x ~8 cols) = ~4,000 parameters`. Well within PostgreSQL's 65,535 parameter limit.

#### Processing Logic

```
1. AUTHENTICATE
   userId = requireAuth(event)

2. VALIDATE
   body = readBody(event)
   parsed = batchSyncSchema.parse(body)
   If invalid → 400 with Zod error details

3. OWNERSHIP CHECK
   For every item across all arrays:
     If item has an ownerId field and it !== userId → 403 Forbidden
   Inject ownerId = userId on all items

4. EMPTY CHECK
   If all arrays are empty → return { success: true, syncedAt: serverTime }

5. TRANSACTION (single db.transaction())
   a. DELETIONS (process first to respect ordering)
      For each deletion:
        Delete entity by (entityId, ownerId) from the appropriate table
        Insert syncDeletions record { entityId, entityType, ownerId }

   b. HABITS
      db.insert(habitsTable)
        .values(habits)  // ownerId injected
        .onConflictDoUpdate({
          target: habitsTable.id,
          set: { title, description, color, sharedWith, ..., updatedAt },
          where: eq(habitsTable.ownerId, userId)   // ownership guard
        })

   c. HABIT LOGS
      db.insert(habitLogs)
        .values(logs)  // ownerId injected
        .onConflictDoUpdate({
          target: habitLogs.id,
          set: { status, sharedWith, updatedAt },
          where: eq(habitLogs.ownerId, userId)     // ownership guard
        })
      // Handles both retry idempotency and mutable updates
      // (e.g., changing status from 'completed' to 'skipped')

   d. BUCKETS
      Same upsert pattern as habits

   e. BUCKET LOGS
      Same upsert pattern as habit logs

   f. DIRTY FLAG
      db.insert(userSyncStates)
        .values({ userId, cascadeVersion: 1 })
        .onConflictDoUpdate({
          target: userSyncStates.userId,
          set: { cascadeVersion: sql`${userSyncStates.cascadeVersion} + 1` }
        })

6. BACKGROUND CASCADE (after transaction commits, outside transaction)
   triggerImmediateCascade(event, userId)  // See Phase 3

7. RESPONSE
   { success: true, syncedAt: <server timestamp from getServerTime()> }
```

#### Error Handling

| Error | HTTP Status | Behavior |
|-------|-------------|----------|
| Validation failure | 400 | Zod error details in response. No DB changes. |
| Ownership violation | 403 | Entire batch rejected. No DB changes. |
| Transaction failure (FK violation, etc.) | 500 | Auto-rollback. Client retries entire batch. |
| Auth failure | 401 | Standard auth error. |

---

### 4.3 [MODIFY] `app/composables/useHabitsApi.ts`

Refactor `processPushPhase()` (currently ~lines 432-523) to use the batch endpoint.

#### Current Behavior (to be replaced)
- Iterates each entity type separately in `for...of` loops.
- Sends one HTTP request per unsynced item (`client.postHabit`, `client.putHabit`, `client.postHabitLog`, etc.).
- Per-item error handling with status-specific recovery (409 → mark synced, 404 → delete local, 4xx → toast, 5xx → rethrow).

#### New Behavior

**Phase 0 — Action Queue (unchanged):**
- Process REORDER operations from `db.syncQueue` individually (order-sensitive, must remain sequential).
- Process DELETE operations from `db.syncQueue` — collect these into the batch `deletions` array instead of individual DELETE requests.

**Phase 1 — Batched Push:**

```
1. COLLECT unsynced items from IndexedDB:
   habits    = db.habits.where('synced').notEqual(1).filter(h => h.ownerId === userId)
   habitLogs = db.habitLogs.where('synced').equals(0).filter(l => l.ownerId === userId)
   buckets   = db.buckets.where('synced').notEqual(1).filter(b => b.ownerId === userId)
   bucketLogs= db.bucketLogs.where('synced').equals(0).filter(l => l.ownerId === userId)

2. CHUNK into batches (max 100 per entity type per request):
   while (any entity type has remaining items) {
     chunk = {
       habits:     remainingHabits.splice(0, 100),
       habitLogs:  remainingHabitLogs.splice(0, 100),
       buckets:    remainingBuckets.splice(0, 100),
       bucketLogs: remainingBucketLogs.splice(0, 100),
       deletions:  remainingDeletions.splice(0, 100),  // from Phase 0
     }

     response = POST /api/v2/sync/batch  with chunk body

     if (response.ok) {
       // Mark ONLY this chunk's items as synced in a Dexie transaction
       await db.transaction('rw', [db.habits, db.habitLogs, ...], async () => {
         for each habit in chunk.habits:    db.habits.update(habit.id, { synced: 1 })
         for each log in chunk.habitLogs:   db.habitLogs.update(log.id, { synced: 1 })
         for each bucket in chunk.buckets:  db.buckets.update(bucket.id, { synced: 1 })
         for each log in chunk.bucketLogs:  db.bucketLogs.update(log.id, { synced: 1 })
         // Remove successful deletions from syncQueue
       })
     } else {
       // Chunk failed. Items remain unsynced for next sync cycle.
       // Rethrow to trigger exponential backoff in the sync engine.
       throw new Error(`Batch sync failed: ${response.status}`)
     }
   }
```

**State integrity guarantee**: Items are only marked `synced: 1` after the server confirms 200 OK for that specific chunk. If any chunk fails, its items retain their unsynced status and retry on the next sync cycle. Previously synced chunks are not affected.

**Backward compatibility**: The individual endpoints (`POST /api/habits`, `POST /api/habitlogs`, etc.) are **not removed**. They continue to serve single-item creation from the UI. Only the sync engine's push phase switches to batch.

---

### 4.4 Phase 2 Tests

#### [MODIFY] `server/tests/test.utils.ts`

Add helper functions:
```typescript
createUserSyncState(userId: string, cascadeVersion?: number)
  → inserts a row into userSyncStates

getUserSyncState(userId: string)
  → reads and returns the userSyncStates row for assertions
```

#### [NEW] `server/tests/sync.batch.spec.ts`

| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | Happy path: batch with 3 habits, 5 habit logs, 2 buckets, 3 bucket logs | Create test user, submit batch | 200 OK. All entities persisted. `userSyncStates.cascadeVersion > 0`. |
| 2 | Idempotency: submit same batch twice | Submit identical batch 2x | 200 OK both times. No duplicate rows. `cascadeVersion` incremented twice. |
| 3 | Mutable update: log with status `completed`, then same ID with `skipped` | Submit log, then submit again with changed status | Log status is `skipped` in DB. |
| 4 | Ownership enforcement: batch contains habit with different user's `ownerId` | Two test users, submit with wrong ownerId | 403 Forbidden. Entire batch rejected, nothing persisted. |
| 5 | Array overflow: 101 items in one entity array | Submit batch with 101 habits | 400 validation error. |
| 6 | Empty batch: all arrays empty | Submit `{}` | 200 OK (no-op). No `cascadeVersion` change. |
| 7 | Transaction atomicity: invalid FK in one entity | Submit batch with habitLog referencing non-existent habitId | 500. Full rollback — no entities from the batch persisted. |
| 8 | Deletions: delete an existing habit via batch | Create habit, then submit batch with deletion | Habit gone. `syncDeletions` record exists. |
| 9 | Unauthenticated request | No auth context | 401. |
| 10 | Mixed new + update: batch with new habits and updated existing habits | Submit batch with mix | All correctly inserted/updated via upsert. |

---

## 5. Phase 3: Persistent Background Cascades

**Objective**: Move expensive streak recalculations and Pusher notifications from the batch endpoint's request cycle to reliable, debounced background processing. Fix the existing Pusher fire-and-forget silent-drop bug.

**Dependency**: Phase 2 must be complete (`userSyncStates` table exists, batch endpoint works).

---

### 5.1 [NEW] `server/utils/waitUntil.ts`

Platform-aware utility for deferring work after the response is sent.

```typescript
import type { H3Event } from 'h3'

/**
 * Registers a promise to continue executing after the response is sent.
 *
 * Cloudflare Workers: event.context.cloudflare.context.waitUntil(promise)
 * Dev/Test fallback:  fire-and-forget with error logging
 */
export function useWaitUntil(event: H3Event, promise: Promise<unknown>): void {
  const cfCtx = event?.context?.cloudflare?.context
  if (cfCtx?.waitUntil) {
    cfCtx.waitUntil(promise)
  } else {
    promise.catch((err) => console.error('[waitUntil fallback]', err))
  }
}
```

**Critical**: On `cloudflare-module`, the path is `event.context.cloudflare.context.waitUntil()`. Not `event.waitUntil` (which does not exist). See AD-5.

---

### 5.2 [NEW] `server/utils/cascade.ts`

Core cascade logic, shared between the immediate trigger and the cron safety net.

#### `executeCascadeForUser(db, userId): Promise<boolean>`

```
1. CAPTURE STATE
   row = SELECT cascade_version FROM user_sync_states WHERE user_id = userId
   If row is null or cascadeVersion === 0 → return false (nothing to do)

2. STORE captured version
   capturedVersion = row.cascadeVersion

3. RECALCULATE STREAKS
   a. Fetch all habit IDs for the user
   b. For each habit: recalculateHabitStreak(db, habitId, userId)
      // Full rebuild mode (no fromDate) — safe for batch reconciliation
      // where many dates may have changed
   c. Fetch all bucket IDs for the user
   d. reevaluateMultipleBuckets(db, bucketIds)

4. BROADCAST PUSHER NOTIFICATIONS
   pusher?.trigger(`user-${userId}-habits`, 'sync-settled', {})
   pusher?.trigger(`user-${userId}-buckets`, 'sync-settled', {})

5. ATOMIC RESET (compare-and-swap)
   result = UPDATE user_sync_states
            SET cascade_version = 0, last_cascade_at = NOW()
            WHERE user_id = userId AND cascade_version = capturedVersion

6. CONFLICT DETECTION
   If result.rowCount === 0:
     // A newer sync incremented the version during our execution.
     // The row stays dirty. Next trigger/cron will catch it.
     return false

7. return true
```

#### `triggerImmediateCascade(event, userId): void`

Called from the batch endpoint after the transaction commits:

```typescript
export function triggerImmediateCascade(event: H3Event, userId: string): void {
  const db = useDB(event)
  useWaitUntil(event, executeCascadeForUser(db, userId))
}
```

This provides ~1-2s social latency for cascade effects while keeping the response fast.

---

### 5.3 [MODIFY] Pusher Fire-and-Forget Fix

**Current bug**: All Pusher triggers in `habit.service.ts` and `bucket.service.ts` are fire-and-forget:
```typescript
pusher?.trigger(`user-${userId}-habits`, 'sync-settled', {})  // Promise ignored
```

On Cloudflare Workers, the isolate terminates after sending the response. If the Pusher HTTP call hasn't completed, it's silently dropped.

**Fix**: Wrap all existing Pusher trigger calls with `useWaitUntil()`. This requires threading the `event` parameter through to service functions that trigger Pusher.

**Current pattern** (in service files):
```typescript
const pusher = getPusher(event)
pusher?.trigger(channel, eventName, data)
```

**Updated pattern:**
```typescript
const pusher = getPusher(event)
if (pusher) {
  useWaitUntil(event, pusher.trigger(channel, eventName, data))
}
```

**Affected files:**
- `server/services/habit.service.ts` — `logHabit`, `createHabit`, `deleteHabitLog`, `updateHabit`, `deleteHabit`
- `server/services/bucket.service.ts` — `logBucket`, `updateBucket`, `deleteBucket`

**Note**: If `event` is not currently passed to these service functions, the function signatures must be updated to accept it. Check each call site.

---

### 5.4 [NEW] `server/tasks/sync/cascade.ts`

Nitro scheduled task — the "zombie pass" safety net.

```typescript
export default defineTask({
  meta: {
    name: 'sync:cascade',
    description: 'Process pending cascade operations for dirty users',
  },
  async run() {
    const db = useDB()  // Global singleton (no event context for cron tasks)

    const dirtyUsers = await db
      .select({ userId: userSyncStates.userId })
      .from(userSyncStates)
      .where(gt(userSyncStates.cascadeVersion, 0))
      .orderBy(asc(userSyncStates.lastCascadeAt))  // Oldest first
      .limit(50)  // Bounded: Workers have 30s CPU limit (see AD-7)

    for (const { userId } of dirtyUsers) {
      await executeCascadeForUser(db, userId)
    }

    return { result: `Processed ${dirtyUsers.length} users` }
  },
})
```

**Directory**: `server/tasks/sync/cascade.ts`. The `server/tasks/` directory does not currently exist and must be created.

---

### 5.5 [MODIFY] `nuxt.config.ts`

Add Nitro experimental task configuration to the existing `nitro` block:

```typescript
nitro: {
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '* * * * *': ['sync:cascade'],  // Every 1 minute
  },
  // ... existing preset, routeRules, storage, ignore, etc.
}
```

---

### 5.6 [MODIFY] `wrangler.toml`

Add cron trigger configuration. Both Nitro config AND wrangler.toml are required (see AD-6).

**Add to default environment** (after existing config):
```toml
[triggers]
crons = ["* * * * *"]
```

**Add to production environment** (inside `[env.production]` section):
```toml
[env.production.triggers]
crons = ["* * * * *"]
```

---

### 5.7 Phase 3 Tests

#### [MODIFY] `server/tests/test.utils.ts`

Add helpers (if not already added in Phase 2):
```typescript
createUserSyncState(userId: string, cascadeVersion?: number)
getUserSyncState(userId: string)
```

#### [MODIFY] `server/tests/setup.ts`

Add mock for `useWaitUntil` if the test environment doesn't have `event.context.cloudflare`. The utility's built-in dev fallback may suffice, but verify.

#### [NEW] `server/tests/sync.cascade.spec.ts`

| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | Dirty flag set by batch | Submit a batch for a user | `userSyncStates.cascadeVersion > 0` for that user. |
| 2 | Cascade execution | Create user with habits + logs. Set `cascadeVersion = 1`. Call `executeCascadeForUser()`. | Streaks recalculated correctly. `cascadeVersion = 0`. `lastCascadeAt` is set. |
| 3 | Concurrent safety (CAS) | Set `cascadeVersion = 1`. Start cascade. Before it resets, increment `cascadeVersion` to 2 in DB. | The `UPDATE ... WHERE cascade_version = 1` affects 0 rows. `cascadeVersion` remains 2 (still dirty). Function returns `false`. |
| 4 | No-op on clean user | Set `cascadeVersion = 0`. Call `executeCascadeForUser()`. | Returns `false`. No DB writes occur. No streak recalculation. |
| 5 | Multiple dirty users | Set `cascadeVersion > 0` for 3 test users. Call the task's `run()` function logic. | All 3 processed and reset to 0. |
| 6 | Bounded processing | Set `cascadeVersion > 0` for 60 test users. Call `run()`. | Only 50 processed. 10 remain dirty for next pass. |

---

## 6. TDD Execution Workflow

### Phase 1: Security & Primitives

**Red:**
1. Create `server/tests/security.bodylimit.spec.ts`. Import the (not yet existing) middleware handler. Tests should fail to import or fail assertions since no enforcement exists.
2. Add cases to `server/tests/validation.schema.spec.ts`: test that `loginSchema` accepts a 300-char password (currently passes — vulnerable state). After fix, 73+ chars must be rejected.

**Green:**
1. Create `server/utils/schemaPrimitives.ts`.
2. Create `server/middleware/bodyLimit.ts`.
3. Refactor `server/utils/validation.ts` to use primitives.
4. Re-run all tests. Body limit tests now return 413 for oversized payloads. Login rejects 256+ chars. Registration rejects 73+ chars.

**Verify:**
1. Run full test suite — all 53+ existing tests must still pass (no regressions from primitive extraction).
2. Run type check (`npx nuxi typecheck` or `npx tsc --noEmit`) — no type errors introduced.

### Phase 2: Batch Sync

**Red:**
1. Create `server/tests/sync.batch.spec.ts`. Import the batch handler (does not exist yet). Test should fail at import.

**Green:**
1. Add `userSyncStates` to `server/db/schema.ts`.
2. Generate and apply Drizzle migration.
3. Add test helpers to `server/tests/test.utils.ts`.
4. Implement `server/api/v2/sync/batch.post.ts`.
5. Re-run tests. All batch tests pass.

**Verify:**
1. Run full test suite — no regressions.
2. Run type check.

### Phase 3: Cascades

**Red:**
1. Create `server/tests/sync.cascade.spec.ts`. Import `executeCascadeForUser` (does not exist). Test fails at import.

**Green:**
1. Create `server/utils/waitUntil.ts`.
2. Create `server/utils/cascade.ts` with `executeCascadeForUser` and `triggerImmediateCascade`.
3. Create `server/tasks/sync/cascade.ts`.
4. Update `nuxt.config.ts` with experimental tasks config.
5. Update `wrangler.toml` with cron triggers.
6. Wire `triggerImmediateCascade` into the batch endpoint (modify `batch.post.ts`).
7. Wrap existing Pusher triggers with `useWaitUntil` in service files.
8. Re-run tests. Cascades execute, streaks update, version resets to 0.

**Verify:**
1. Run full test suite — all 53+ existing tests plus all new tests pass.
2. Run type check.
3. Refactor `app/composables/useHabitsApi.ts` to use chunked batch push.

---

## 7. Verification Plan

### Automated Test Matrix

| # | Category | Test | Expected Result |
|---|----------|------|-----------------|
| 1 | Security | POST 150KB to `/api/habits` via middleware | 413 Payload Too Large |
| 2 | Security | POST 200KB to `/api/v2/sync/batch` via middleware | Passes (under 250KB) |
| 3 | Security | POST 300KB to `/api/v2/sync/batch` via middleware | 413 Payload Too Large |
| 4 | Security | Register with 73-char password | 400 validation error |
| 5 | Security | Login with 72-char password | Passes validation |
| 6 | Security | Login with 73-char password | 400 validation error |
| 7 | Batch | Push 3 habits + 5 logs + 2 buckets + 3 bucket logs | 200 OK, all persisted |
| 8 | Batch | Push same batch twice | 200 OK, no duplicates |
| 9 | Batch | Push with wrong `ownerId` | 403 Forbidden |
| 10 | Batch | Push 101 items in one array | 400 validation error |
| 11 | Batch | Empty batch | 200 OK no-op |
| 12 | Batch | Invalid FK in batch | 500, full rollback |
| 13 | Batch | Delete via batch | Entity removed, syncDeletion recorded |
| 14 | Cascade | Batch sets dirty flag | `cascadeVersion > 0` |
| 15 | Cascade | Execute cascade for dirty user | Streaks updated, version reset to 0 |
| 16 | Cascade | Concurrent version bump during cascade | CAS fails, version stays dirty |
| 17 | Cascade | Cascade on clean user | No-op, returns false |
| 18 | Cascade | Cron with 60 dirty users | Only 50 processed |

### Manual Verification

1. **Offline reconciliation**: Enable airplane mode on a test device. Make 50+ changes (create habits, log completions, create buckets). Reconnect. Verify all changes sync via batch endpoint (network tab shows chunked requests ≤100 items each). Verify streaks update on server within 60 seconds.

2. **Rapid spam**: While online, rapidly toggle habit completions. Verify the batch endpoint debounces cascades — streaks don't recalculate per-click but are caught by the next cascade trigger or cron pass.

3. **Pusher reliability**: After batch sync, verify Pusher events arrive at connected secondary sessions (validates `useWaitUntil` wrapper prevents isolate termination drops). Compare with current behavior where events are non-deterministically dropped.

4. **Payload rejection**: Use `curl` or Postman to POST a 150KB JSON body to `/api/habits`. Verify 413 response. POST 200KB to `/api/v2/sync/batch`. Verify 200 OK.

---

## 8. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | Neon HTTP transactions fail under load | Low | High | Drizzle + Neon Pool supports transactions via HTTP mode. Load test in staging before production deploy. Monitor transaction duration. |
| 2 | Cron task exceeds 30s CPU limit | Medium | Medium | Bounded to 50 users per pass (`LIMIT 50`). Monitor execution time via Cloudflare dashboard. Reduce limit if needed. |
| 3 | Password limit rejects legitimate login | None | None | Uniform `max(72)` across all auth endpoints. No existing users have passwords exceeding 72 characters. bcrypt truncates at 72 bytes regardless, so longer passwords provided zero additional security. See AD-8. |
| 4 | `waitUntil` unavailable in test/dev | Certain | None | `useWaitUntil` has explicit fallback — fire-and-forget with `.catch()` logging. |
| 5 | Client sends both individual and batch requests during rollout | Medium | Low | Individual endpoints retained with inline streaks. Both paths are valid and independently consistent. |
| 6 | Cascade full-rebuild is expensive for users with large histories | Medium | Medium | `recalculateHabitStreak` fetches all logs for the habit. For users with years of history, this could be slow. Monitor query duration. Future optimization: add `fromDate` parameter based on earliest changed log. |
| 7 | Missing `wrangler.toml` cron config in one environment | Low | High | Checklist item: verify both staging and production sections have `[triggers] crons`. Test by checking Cloudflare dashboard for registered cron triggers. |
| 8 | Body limit middleware blocks legitimate large requests | Low | Medium | Route-specific overrides in the limit map. Monitor 413 error rates. Adjust limits if legitimate payloads are rejected. |

---

## 9. File Change Summary

| Phase | Action | File Path | Description |
|-------|--------|-----------|-------------|
| 1 | NEW | `server/utils/schemaPrimitives.ts` | Bounded Zod primitives (zId, zShortText, zLongText, zPassword, etc.) |
| 1 | MODIFY | `server/utils/validation.ts` | Refactor all schemas to use primitives |
| 1 | NEW | `server/middleware/bodyLimit.ts` | Request body size enforcement middleware |
| 1 | NEW | `server/tests/security.bodylimit.spec.ts` | Middleware unit tests |
| 1 | MODIFY | `server/tests/validation.schema.spec.ts` | Add primitive and password limit tests |
| 2 | MODIFY | `server/db/schema.ts` | Add `userSyncStates` table |
| 2 | NEW | `server/db/migrations/XXXX_*.sql` | Auto-generated by `drizzle-kit generate` |
| 2 | MODIFY | `server/tests/test.utils.ts` | Add `createUserSyncState`, `getUserSyncState` helpers |
| 2 | NEW | `server/api/v2/sync/batch.post.ts` | Transactional batch sync endpoint |
| 2 | NEW | `server/tests/sync.batch.spec.ts` | Batch endpoint tests |
| 2 | MODIFY | `app/composables/useHabitsApi.ts` | Refactor push phase to chunked batch |
| 3 | NEW | `server/utils/waitUntil.ts` | Platform-aware `useWaitUntil` utility |
| 3 | NEW | `server/utils/cascade.ts` | `executeCascadeForUser` + `triggerImmediateCascade` |
| 3 | NEW | `server/tasks/sync/cascade.ts` | Nitro cron task (zombie pass safety net) |
| 3 | MODIFY | `nuxt.config.ts` | Add `nitro.experimental.tasks` + `scheduledTasks` |
| 3 | MODIFY | `wrangler.toml` | Add `[triggers] crons` in both environments |
| 3 | MODIFY | `server/services/habit.service.ts` | Wrap Pusher triggers with `useWaitUntil` |
| 3 | MODIFY | `server/services/bucket.service.ts` | Wrap Pusher triggers with `useWaitUntil` |
| 3 | NEW | `server/tests/sync.cascade.spec.ts` | Cascade logic + cron tests |
| 3 | MODIFY | `server/tests/setup.ts` | Add mocks if needed for `useWaitUntil` |
| 3 | MODIFY | `server/tests/test.utils.ts` | Add sync state helpers (if not done in Phase 2) |
