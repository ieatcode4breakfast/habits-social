# Frontend V2 API Migration Plan

**Goal:** Migrate all frontend API calls from the archived `_v1` endpoints to the active V2 endpoints (`server/api/`). No UI changes. No server-side refactoring of existing V2 handlers. Pusher/realtime code is explicitly out of scope.

**Current Problem:** The frontend composables and pages still reference V1 behavior and response shapes, but V1 is archived under `server/api/_v1/` and is ignored by Nitro. The V2 endpoints are live but use a strict `{ data: ... }` response envelope, different route names for social features, and have no monolithic `/api/sync` endpoint.

---

## 1. V1 vs V2: Key Differences

### 1.1 Response Wrapping
Every V2 endpoint **must** be unwrapped with `.data`. Example:
- V1: `GET /api/habits` → `[{ id: '...' }]`
- V2: `GET /api/habits` → `{ data: [{ id: '...' }] }`

### 1.2 Snake_case → CamelCase Normalization
V2 normalizers (`server/utils/normalize.ts`) handle all DB column aliases cleanly. The frontend should trust camelCase properties in `.data`.

### 1.3 Social Route Restructure
The monolithic V1 social routes have been split in V2:

| Operation | V1 Route | V2 Route |
|---|---|---|
| List friends | `GET /api/social/friends` | `GET /api/friendships` |
| Send request | `POST /api/social/friends` | `POST /api/friendships` |
| Accept request | `PUT /api/social/requests/:id` | `PUT /api/friendships/:id` |
| Remove/Decline | `DELETE /api/social/friends/:id` | `DELETE /api/friendships/:id` |
| Toggle favorite | `PUT /api/social/friends/favorite` | `PUT /api/friendships/favorite` |
| Search users | `GET /api/social/search` | `GET /api/users/search` |
| Get user profile | `GET /api/social/profile` | `GET /api/users/me` |
| Friend data | `GET /api/social/friend-data` | `GET /api/social/friend-data` |
| Habit details | `GET /api/social/habit-details` | `GET /api/social/habit-details` |
| Share habits | `POST /api/social/share-habits` | `POST /api/social/share-habits` |
| Activity feed | `GET /api/social/feed` | `GET /api/social/feed` |

> Note: The `GET /api/social/*` query routes remain the same in V2 (feed, friend-data, habit-details, share-habits). Only the **friendship CRUD** moved to `/api/friendships`.

### 1.4 The Missing `/api/sync` Endpoint (Critical Gap)
V1 provided a single `GET /api/sync` endpoint that returned `habits`, `buckets`, `habitLogs`, `bucketLogs`, **deletions**, and **serverTime**.

**V2 has no equivalent.** V2 supports `lastSynced` query params on:
- `GET /api/habits?lastSynced=...`
- `GET /api/buckets?lastSynced=...`
- `GET /api/habitlogs?lastSynced=...`
- `GET /api/bucketlogs?lastSynced=...`

But none of these return deleted IDs or a server clock.

**Impact:** Cross-device deletion propagation is broken if we only use individual endpoints.

---

## 2. Execution Phases

### Phase 1: Update Core Composables & Response Unwrapping

**Files:**
- `app/composables/useAuth.ts`
- `app/composables/useHabitsApi.ts`
- `app/composables/useSocial.ts`

**Work:**
1. Update `$fetch` type signatures to expect `{ data: T }`.
2. Add `.data` to every response read.
3. `useAuth.ts`: handle `GET /api/auth/me` returning `{ data: user }` instead of `{ user }`.
4. `useSocial.ts`: remap `GET /api/social/friends` → `GET /api/friendships`, `POST /api/social/friends` → `POST /api/friendships`, `PUT /api/social/friends/favorite` → `PUT /api/friendships/favorite`.
5. Add `PUT /api/friendships/:id` and `DELETE /api/friendships/:id` wrappers to `useSocial.ts` if not already present.

### Phase 2: Add V2 `/api/sync` Endpoint & Update Sync Engine

**Decision:** Option B approved — add a minimal V2 sync endpoint.

**New File:** `server/api/sync.get.ts`

**Design:** Mirror the V1 sync logic but use V2 SQL patterns, column names, and normalizers. The endpoint must:
1. Accept `lastSynced` (numeric ms timestamp) and optional `startDate`/`endDate`.
2. Query the database for habits, personal buckets, shared buckets, habit logs, bucket logs, and deletions filtered by `updated_at >= to_timestamp(lastSynced / 1000.0)`.
3. Normalize all returned rows using `normalizeHabit`, `normalizeBucket`, and `normalizeLog` from `server/utils/normalize.ts`.
4. Return an exact V1-compatible envelope (no `{ data: ... }` wrapper) so the existing `useHabitsApi.ts` sync block can consume it with minimal changes:
   ```ts
   {
     habits: Habit[],
     buckets: Bucket[],
     habitLogs: HabitLog[],
     bucketLogs: BucketLog[],
     deletions: { id: string, type: string }[],
     serverTime: number
   }
   ```

**File:** `app/composables/useHabitsApi.ts`

**Work:**
1. Keep the existing `GET /api/sync` call path. The only required change is ensuring the response typing matches the unwrapped envelope above (no `.data` for this specific endpoint).
2. Adjust push-phase response handling (`POST /api/habits`, `PUT /api/habits/:id`, etc.) to unwrap `.data` as required by all other V2 endpoints.
3. For `POST /api/habitlogs`, remove the dependency on the returned `habit` object since V2 returns `{ data: log }` only.

### Phase 3: Update Social Pages for New Friendship Routes

**Files:**
- `app/pages/social.vue`
- `app/pages/friends/[id].vue`

**Work:** Update raw `$fetch` calls to match V2 friendship routes and response shapes.

### Phase 4: Handle the HabitLog POST Response Change

**Gap:** V1 `POST /api/habitlogs` returned `{ log: HabitLog, habit: Habit }`. V2 returns `{ data: HabitLog }` only.

**Fix in frontend:**
In `useHabitsApi.ts`, change:
```ts
const { habit } = response;
await db.habitLogs.update(l.id, { synced: 1 });
if (habit) {
  await db.habits.update(habit.id, { synced: 1 });
}
```
Remove the habit dependency. The habit will reconcile on the next pull sync anyway.

---

## 3. Files to Modify (Exact List)

### New File
6. `server/api/sync.get.ts`

### Modified Files
1. `app/composables/useAuth.ts`
2. `app/composables/useHabitsApi.ts`
3. `app/composables/useSocial.ts`
4. `app/pages/social.vue`
5. `app/pages/friends/[id].vue`

> `app/composables/useRealtime.ts` is **not** touched per your instruction (no Pusher changes).

---

## 4. Known Risks & Follow-ups

| Risk | Severity | Mitigation |
|---|---|---|
| HabitLog POST no longer returns habit object | Low | Remove frontend dependency on returned habit; rely on next pull sync |
| Column name normalization might have edge cases | Low | V2 normalizers are comprehensive; test with real data |
| Sync endpoint must mirror V1 envelope exactly | Medium | Validate V2 sync handler returns plain object (not `{ data }` wrapper) matching `useHabitsApi.ts` expectations |

---

## 5. Implementation Order

1. **Create `server/api/sync.get.ts`** — ensures the sync contract is ready before frontend changes.
2. **Update `app/composables/useAuth.ts`** — minimal change, low risk.
3. **Update `app/composables/useSocial.ts` + pages** — map friendship routes and unwrap `.data`.
4. **Update `app/composables/useHabitsApi.ts`** — adjust all V2 `.data` unwrapping and keep the `/api/sync` call as-is (since the new endpoint will match V1 envelope).
5. **Smoke test** — verify login, habit CRUD, log CRUD, bucket CRUD, friend CRUD, and cross-tab sync.
