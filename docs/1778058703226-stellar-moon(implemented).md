# Plan: Codebase camelCase Data with snake_case Database

## Status

**Database migration is COMPLETE.** The staging branch (`br-broad-frog-aoi1e8ml`) has been fully migrated to snake_case:
- All 6 camelCase table names renamed to snake_case: `bucket_habits`, `bucket_logs`, `habit_logs`, `share_events`, `shared_bucket_members`, `sync_deletions`
- All columns renamed to snake_case (e.g., `ownerId` → `owner_id`, `updatedAt` → `updated_at`, `streakCount` → `streak_count`, etc.)
- Indexes and constraints preserved and functional

**What remains:** Update the entire codebase so that TypeScript interfaces, API payloads, validation schemas, client-side Dexie stores, and Vue components use consistent **camelCase** for all data fields. The server layer will communicate with the database using snake_case columns.

## Strategy

Use a thin **snake_case ↔ camelCase mapping layer** to keep SQL readable and avoid massive `SELECT owner_id AS "ownerId"` boilerplate across 50+ files.

1. **Server-side transformer**: Add `toCamelCase(obj)` and `toSnakeCase(obj)` utilities in `server/utils/transform.ts`.
2. **SQL queries**: Keep raw SQL using snake_case columns (no aliases). After `await sql">"..."`, pipe results through `toCamelCase()` before returning.
3. **INSERT/UPDATE**: Accept camelCase payloads from clients, transform to snake_case before interpolating into SQL.
4. **Types/interfaces**: Update all interfaces to camelCase.
5. **Validation schemas**: Update Zod schemas to camelCase.
6. **Client-side**: Update Dexie schema indexes and all composables/components to camelCase.

## Mapping Reference

| DB (snake_case) | Code (camelCase) |
|---|---|
| `owner_id` | `ownerId` |
| `updated_at` | `updatedAt` |
| `photo_url` | `photoUrl` |
| `shared_with` | `sharedWith` |
| `bucket_id` | `bucketId` |
| `habit_id` | `habitId` |
| `user_date` | `userDate` |
| `created_at` | `createdAt` |
| `recipient_id` | `recipientId` |
| `habit_ids` | `habitIds` |
| `entity_id` | `entityId` |
| `entity_type` | `entityType` |
| `added_by` | `addedBy` |
| `approval_status` | `approvalStatus` |
| `streak_count` | `streakCount` |
| `broken_streak_count` | `brokenStreakCount` |
| `current_streak` | `currentStreak` |
| `longest_streak` | `longestStreak` |
| `streak_anchor_date` | `streakAnchorDate` |
| `skips_count` | `skipsCount` |
| `skips_period` | `skipsPeriod` |
| `sort_order` | `sortOrder` |
| `password_hash` | `passwordHash` |
| `email_verified_at` | `emailVerifiedAt` |
| `initiator_id` | `initiatorId` |
| `receiver_id` | `receiverId` |
| `initiator_favorite` | `initiatorFavorite` |
| `receiver_favorite` | `receiverFavorite` |

## Execution Phases

### Phase 1: Add Mapping Utilities
- Create `server/utils/transform.ts` with `toCamelCase`, `toSnakeCase`, and array variants.
- Update `server/utils/db.ts` or create a wrapper that auto-transforms query results.

### Phase 2: Server Types & Interfaces
- Update `server/models/index.ts` → all fields camelCase.
- Update `server/api/v2/_types/index.ts` → all fields camelCase.

### Phase 3: Validation Schemas
- Update `server/api/v2/_utils/validation.ts` → Zod schemas use camelCase fields (`ownerId`, `sharedWith`, `userDate`, etc.).

### Phase 4: Server API Endpoints (v2)
- Update all `server/api/v2/**/*.ts` endpoints:
  - Read bodies/params as camelCase.
  - Transform to snake_case before SQL INSERT/UPDATE.
  - Transform SQL results to camelCase before returning.
- Endpoints: `habits/*`, `habitlogs/*`, `buckets/*`, `bucketlogs/*`, `friendships/*`, `social/*`, `users/*`, `auth/*`, `sync.ts`.

### Phase 5: Legacy Server API (v1)
- Update `server/api/**/*.ts` (non-v2) with the same pattern.

### Phase 6: Server Utils
- Update `server/utils/streaks.ts`, `buckets.ts`, `shared-buckets.ts`, `normalize.ts`, `auth.ts`, `validation.ts`.
- Update `server/api/v2/_utils/streaks.ts`, `buckets.ts`, `shared-buckets.ts`, `normalize.ts`, `auth.ts`, `db.ts`.

### Phase 7: Client-Side Types & Dexie
- Update `app/utils/db.ts`: bump Dexie schema version, change index keys to camelCase (`ownerId`, `habitId`, `bucketId`).
- Update `app/composables/useHabitsApi.ts`: all interfaces and internal references to camelCase.
- Update `app/composables/useAuth.ts`, `useSocial.ts`.

### Phase 8: Client Components & Pages
- Update all `app/components/*.vue` and `app/pages/*.vue` references.

### Phase 9: Tests
- Update `server/api/v2/_tests/*.spec.ts` and `test.utils.ts` to match camelCase payloads and assertions.

### Phase 10: Documentation
- Update `docs/data-schema.md` and `server/api/v2/doc/001-data-schema.md` to reflect snake_case DB + camelCase code convention.

### Phase 11: Validation
- Run `npx tsc --noEmit`.
- Run `npm test`.
- Run a global regex search for remaining snake_case field references outside SQL strings and the transformer util.

## Risk Assessment

- **Low risk to DB**: Schema is already migrated and stable.
- **Medium risk to client**: Dexie schema version bump will invalidate old indexes; users will naturally re-sync on next load.
- **Medium risk to tests**: Test assertions checking exact field names will need updates.

## Best Practices

1. **No more DB migrations in this plan** — all DB work is done.
2. **Keep SQL clean** — do not pepper `AS "camelCase"` aliases everywhere; use the transformer utility instead.
3. **Consistency** — once Phase 2 types are locked, every file must use those exact camelCase field names.
