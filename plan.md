# Plan: Habit-Share Push Notification via Sync

## TL;DR
When a user shares a habit from the **Add Habit** or **Edit Habit** modal's "Share with" picker, the recipient gets exactly one push notification: `"<username> shared a habit with you: <habitname>"`. Because the client's sync path is count-dependent (bulk vs individual) and routes through three different server upsert sites, we put the notify logic in **one shared helper** and call it from all three (`HabitService.updateHabit`, `HabitService.createHabit`, `/api/sync/bulk`), each diffing incoming vs persisted `sharedWith` to find **newly added** recipients. Notification-only — no `shareEvents`/feed changes. Reuses `PushService` + `notifyUsersRealtime`. Adds one realtime event `habits.shared`. No new tables/endpoints/modals.

## Architecture context (verified)
- Add/Edit modals → `api.createHabit`/`api.updateHabit` (`app/composables/useHabitsApi.ts`) → local Dexie write → `triggerSync()`.
- **Sync path is count-dependent** (`app/composables/useHabitsApi.ts:585–610`):
  - `totalUnsynced > 1` → `postBulkSync` → `/api/sync/bulk` → **raw upsert, bypasses `HabitService`**.
  - `totalUnsynced === 1` → `postHabit` (new) / `putHabit` (update) → `HabitService.createHabit` / `updateHabit`.
- **`shareEvents` writes are path-dependent and inconsistent (pre-existing bug, verified) — out of scope for this plan, but documented to prevent a NOT NULL trap:**
  - `HabitService.updateHabit` (`server/services/habit.service.ts:209–218`) — **DOES** diff old vs new `sharedWith` and insert `shareEvents` per new recipient, gated `if (newRecipients.length > 0 && updated.userDate)`. ✅
  - `HabitService.createHabit` (`server/services/habit.service.ts:55–148`) — **does NOT** insert `shareEvents`. ❌
  - `/api/sync/bulk` (`server/api/sync/bulk.post.ts:122–150`) — raw upsert, **does NOT** insert `shareEvents`. ❌
  - Net: the same share action produces a feed entry only via the Edit-modal individual-sync path; Add-modal and bulk-sync paths silently miss the feed.
  - **`userDate` reality (verified, corrects a prior misread):** `shareEvents.userDate` is `text('user_date').notNull()` (`schema.ts:124`); `habits.userDate` is nullable (`schema.ts:48`). The Add-modal path is **not** null — `habits.vue:945` `handleHabitAdd` injects `userDate: format(new Date(), 'yyyy-MM-dd')` before `api.createHabit`, so it flows through sync into `createHabit` (`data.userDate || null` → non-null). A `shareEvents` insert in `createHabit` would NOT hit a NOT NULL violation for the Add-modal path. The bulk path *could* hit it for legacy rows lacking `userDate`, which is exactly why the existing sites gate on `&& userDate`. **Moot for this plan — we write zero `shareEvents` rows.** Any future feed-parity work must preserve the `&& userDate` guard.
- `PushService.notifyUser` (`server/services/push.service.ts`) already builds VAPID payloads, batches at `MAX_CONCURRENCY=5`, has 5s timeout, respects blocks, resolves sender username. Currently chat-shaped (`type: 'chat.message'`, url `/inbox`).
- `notifyUsersRealtime` (`server/utils/realtimeNotifier.ts`) validates recipients (max 2 per call), 1.5s timeout, best-effort wrapper exists.
- Realtime event enum (`server/utils/realtime.ts`): currently `['chat.changed','friends.changed']` — strict schema, party server re-validates.
- Client `useRealtimeInvalidation.ts`: routes `chat.changed` → chat refresh; everything else → `scheduleFriendsRefresh()` (refreshes friendships via `useSocial.refresh`, **not** the feed).
- Social feed is page-scoped in `app/pages/social.vue` (`loadFeed`, gated by `shouldRefreshFeed` 10-min staleness). No shared feed store/composable exists.
- `shareEvents` table + `SocialNarratorService.narrateShare` already render shares in the recipient's feed.
- `sanitizeHabitShareRecipientIds` already enforces friendship + block checks; reuse it.

## Steps

### Phase 1 — Server: shared helper + wire all three upsert sites (notification-only)
1. **`server/utils/realtime.ts`** — add `'habits.shared'` to `realtimeInvalidationEventSchema` enum. *Party server re-uses this schema, so it flows through automatically.*
2. **`server/services/push.service.ts`** — add `static async notifyHabitShare(db, recipientId, senderId, habitId, habitTitle)`:
   - Reuse `findActiveSubscriptions`, `hasBlock`, sender-username lookup, `buildPushPayload`, `MAX_CONCURRENCY` batching, `PUSH_TIMEOUT_MS`, 404/410 auto-disable.
   - Payload: `type: 'habit.share'`, `title: senderUsername`, `body: \`shared a habit with you: ${habitTitle}\``, `url: '/social'`, `tag: \`habit-share-${habitId}\`` (collapses re-shares of same habit), `senderId`.
   - Guard `recipientId === senderId` → return. `habitTitle` truncated to 50 chars (matches habit `maxlength`).
3. **`server/services/habit-sharing.service.ts`** — add a shared helper `recordHabitShareNotifications(db, ownerId, notifications: Array<{ recipientId, habitId, habitTitle }>)`:
   - Dedupes by `recipientId+habitId`.
   - For each: best-effort `PushService.notifyHabitShare` (try/catch, `console.warn` on failure) + realtime.
   - Realtime: batch unique recipientIds into groups of ≤2 (`MAX_REALTIME_RECIPIENTS`) → `notifyUsersRealtimeBestEffort(batch, { type: 'habits.shared' })`.
   - **No DB writes** — notification-only. The `shareEvents` table is untouched.
4. **`server/services/habit.service.ts` — `updateHabit`** (lines ~205–218): the `newRecipients` diff already exists (for the existing `shareEvents` insert). **Add only:** after the transaction resolves, call `recordHabitShareNotifications(db, userId, newRecipients.map(r => ({ recipientId: r, habitId: id, habitTitle: updated.title })))`. Reuse the already-computed `newRecipients` — no new diff, no `shareEvents` change.
5. **`server/services/habit.service.ts` — `createHabit`** (lines ~55–148): currently upserts and returns with no share diff. **Add the diff + notify only (no `shareEvents`):**
   - Before the upsert, `SELECT sharedWith` for the habit id (it may exist via `onConflictDoUpdate` → update path). Build `oldSharedSet`.
   - After the upsert, compute `newRecipients = sanitizedSharedWith − oldSharedSet`.
   - Outside the transaction: `recordHabitShareNotifications(db, userId, newRecipients.map(...))`.
   - *No `shareEvents` insert.* The pre-existing feed gap for Add-modal shares is out of scope (see Decisions).
6. **`server/api/sync/bulk.post.ts`** (lines ~122–150): currently raw upsert, no notify. **Add diff + notify only (no `shareEvents`):**
   - Before the upsert: `SELECT id, sharedWith, title` from `habits` where `id IN validHabits.ids AND ownerId = userId` (single set-based query — no N+1). Build `Map<habitId, { existingIds: Set, title }>`.
   - After computing `habitsToInsert` (sanitized `sharedWith`), per habit compute `newlyAdded = sanitizedIncoming − existingIds`.
   - After the upsert succeeds: `recordHabitShareNotifications(db, userId, allNewlyAdded.map(...))`.
   - *No `shareEvents` insert.* The pre-existing feed gap for bulk-sync shares is out of scope.
   - *ponytail note:* fan-out bounded by `bulkSyncSchema` (≤100 ops) × `sanitizeHabitShareRecipientIds` (actual friends only).

### Phase 2 — Client: refresh feed on realtime event
7. **`app/composables/useRealtimeInvalidation.ts`** — in the socket `message` handler, add an explicit branch: `if (parsed.data.type === 'habits.shared') { scheduleFriendsRefresh(); return; }`. 
   - *Decision:* `useSocial.refresh` only refreshes friendships, not the feed. The feed lives in `social.vue` and auto-refreshes on tab focus via `shouldRefreshFeed` (10-min threshold). Rather than build a new shared feed store (YAGNI), we rely on: (a) the push notification deep-links to `/social`, and (b) `social.vue`'s existing focus/visibility refresh picks up the new share event when the user lands there. The `friends.changed`-equivalent refresh keeps the friends list fresh. **No new composable.**
   - *ponytail ceiling:* if the recipient is already on `/social` with the activity tab open and never changes focus, the new share won't appear until the 10-min staleness window or a manual pull-to-refresh. Upgrade path: extract feed state into a `useFeed` composable with a `refreshFeed()` and call it here. Out of scope for "just 1 notification".

### Phase 3 — Tests (TDD) — notification behavior only, no `shareEvents` assertions
8. **`server/tests/sync.bulk.share-notification.spec.ts`** (new) — mirror `social.share.spec.ts` setup; mock `PushService.notifyHabitShare` + `realtimeNotifier.notifyUsersRealtime`:
   - **Case 1:** bulk upsert a new habit with `sharedWith=[friendB]` → `notifyHabitShare` called once with `(friendB, userA, habitId, title)`; realtime `{ type: 'habits.shared' }`.
   - **Case 2:** re-sync same habit, same `sharedWith` → no notify (idempotent).
   - **Case 3:** bulk sync adding a 2nd friend → only the new friend notified.
   - **Case 4:** bulk sync removing a friend from `sharedWith` → no notify (removal isn't a share).
   - **Case 5:** recipient blocked sender → sanitize filters them out; no notify.
   - **Case 6:** push throws → sync still returns success for the habit.
9. **`server/tests/habit.service.share-notification.spec.ts`** (new) — covers `createHabit` and `updateHabit`:
   - **createHabit, new habit with `sharedWith=[friendB]`** → notify called once for friendB.
   - **createHabit, `onConflictDoUpdate` path (existing habit), adding a friend** → notify for the new recipient only.
   - **updateHabit, adding a friend** → existing `shareEvents` behavior preserved (regression guard) + notify called for new recipient.
   - **updateHabit, no change to `sharedWith`** → no notify (regression guard on the existing diff logic).
10. **`server/tests/push.service.spec.ts`** (extend) — add `describe('notifyHabitShare')`: payload `type: 'habit.share'`, correct `body` string, `tag` per habitId, skips self, respects block, truncates long title (>50 chars).
11. **`server/tests/realtime.notifier.spec.ts`** (extend) — `{ type: 'habits.shared' }` passes the schema; an invalid type still rejects.
12. **`app/composables/useRealtimeInvalidation.spec.ts`** (extend) — dispatching `'{"type":"habits.shared"}'` triggers `scheduleFriendsRefresh` (same assertion shape as the existing `friends.changed` test).

### Phase 4 — Type integrity & verification
13. Run `npm run test:types` (`npx nuxi typecheck` + the type-safety spec). Resolve any errors introduced by the new event enum / method signatures.
14. Run the targeted test commands listed in Verification green.
15. Run full `npm run check` and `npm test` to confirm no regressions.

## Relevant files
- `server/services/habit-sharing.service.ts` — add `recordHabitShareNotifications` shared helper (single source of truth for push + realtime fan-out; no DB writes). Reuse `sanitizeHabitShareRecipientIds` (already here).
- `server/services/push.service.ts` — add `notifyHabitShare` static method; reuse `findActiveSubscriptions`/`hasBlock`/sender-username pattern from `notifyUser` (lines ~160–290).
- `server/services/habit.service.ts` — `updateHabit` (~L205–218): add notify call after the existing `shareEvents` insert (reuse existing `newRecipients`). `createHabit` (~L55–148): add diff + notify only (no `shareEvents`).
- `server/api/sync/bulk.post.ts` — habits upsert block (~L122–150): add pre-upsert diff + post-upsert notify (no `shareEvents`).
- `server/utils/realtime.ts` — extend `realtimeInvalidationEventSchema` enum (~L7).
- `app/composables/useRealtimeInvalidation.ts` — add `habits.shared` branch in socket message handler (~L160–170).
- New tests: `server/tests/sync.bulk.share-notification.spec.ts`, `server/tests/habit.service.share-notification.spec.ts`.
- Extend: `server/tests/push.service.spec.ts`, `server/tests/realtime.notifier.spec.ts`, `app/composables/useRealtimeInvalidation.spec.ts`.
- `public/push-sw.js` — **no change needed**; generic handler already reads `data.title`/`data.body`/`data.url`/`data.tag`. Confirmed compatible.

## Verification
1. `npm run test:types` — typecheck passes with new enum value + method signatures.
2. `npm test -- --run sync.bulk.share-notification` — all 6 cases green.
3. `npm test -- --run habit.service.share-notification` — createHabit + updateHabit cases green.
4. `npm test -- --run push.service` — `notifyHabitShare` cases green.
5. `npm test -- --run realtime.notifier` — `habits.shared` schema case green.
6. `npm test -- --run useRealtimeInvalidation` — new event branch case green.
7. `npm run check` — full typecheck clean.
8. `npm test` — full suite green (no regressions in sync/feed/share/stress tests).
9. **Manual (optional, not blocking):** two browsers, userA shares a habit with friend userB via Add Habit modal → userB receives OS notification "userA shared a habit with you: <habit>"; tapping it opens `/social`.

## Decisions
- **Option A chosen:** notify via sync (offline-first). Fires at sync time — instant when online, deferred when offline.
- **Scope = Add/Edit modals only.** `ShareHabitsModal` (uses `share-habits.post.ts`) is **excluded** per the user's explicit instruction. (If later desired, `recordHabitShareNotifications` can be called there too — one line.)
- **Notification-only — no `shareEvents`/feed changes.** The user correctly pointed out the `shareEvents` inconsistency is a pre-existing feed bug unrelated to notifications: push + realtime are fully independent of `shareEvents`. The notification's `/social` deep-link is a URL string and doesn't require a matching feed row. So the plan adds only the diff (to find new recipients) + notify at each site. The pre-existing feed gaps (Add-modal and bulk-sync shares not appearing in the feed) are **out of scope** and left untouched.
- **`userDate` NOT NULL trap — verified and documented (not a blocker for this plan):** A reviewer flagged that inserting `shareEvents` in `createHabit`/bulk would violate `shareEvents.userDate NOT NULL` because the Add modal emits no `userDate`. Verification showed the Add-modal path is **not** null — `habits.vue:945` `handleHabitAdd` injects `userDate: format(new Date(), 'yyyy-MM-dd')` before `api.createHabit`, so it flows through sync. The bulk path *could* still hit it for legacy rows lacking `userDate`, which is why existing sites gate `&& userDate`. **Moot here — zero `shareEvents` writes.** Recorded so a future feed-parity effort preserves the guard and doesn't repeat the misread.
- **Single shared helper** (`recordHabitShareNotifications`) for push+realtime fan-out, called from all three upsert sites. No DB writes.
- **Push tag `habit-share-${habitId}`** so re-shares of the same habit collapse instead of spamming.
- **Realtime batches of ≤2** to respect `MAX_REALTIME_RECIPIENTS`.
- **No new dependency, no new table, no new endpoint, no new modal, no new composable.** One shared helper, one push method, one enum value, one client branch, two new test files + 3 test extensions.

## Further Considerations
1. **Pre-existing feed gap (out of scope, flagged):** Add-modal and bulk-sync shares don't write `shareEvents`, so they won't appear in the recipient's social feed — only Edit-modal individual-sync shares do. This is a pre-existing bug independent of notifications. If you later want feed parity, the diff logic added in Phase 1 makes it a one-line `shareEvents` insert per site — **but it must preserve the `if (... && userDate)` guard** (see `updateHabit:213`, `share-habit.post.ts:78`) to avoid a NOT NULL violation on legacy rows. Not doing it now per "nothing extra".
2. **`ShareHabitsModal`'s `share-habits.post.ts`** — excluded per your instruction. Its `shareEvents` rows already drive the feed; no push from that path.
