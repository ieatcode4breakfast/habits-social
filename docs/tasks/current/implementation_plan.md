# Activity Feed Category 3: Social & Sharing

Implements Triggers 3.1 (Public Commitment) and 3.2 (Shared habits) for the activity feed. **Going-forward only** — no backfilling of existing habits or shares.

---

## Design Decisions (Confirmed)

1. **Trigger 3.1 — always visible to you.** Every new habit creation shows "You committed to..." in your own feed. Friends only see it if the habit is shared with them.
2. **Trigger 3.2 — grouped events.** When sharing multiple habits with a friend at once, it produces **one** feed event (e.g., "shared 3 habits with you"), not one per habit.
3. **Sorting key:** `user_date` (user's local date string) serves as primary sort, then `created_at` (server timestamp), then `id` — matching the existing `ORDER BY date DESC, updatedat DESC, id DESC`.

---

## Proposed Changes

### 1. Database Schema

#### [NEW] `share_events` table

One row per batch share action. Stores all shared habit IDs in a single array.

```sql
CREATE TABLE IF NOT EXISTS share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ownerid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipientid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habitids UUID[] NOT NULL,
  user_date TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### [MODIFY] `habits` table

```sql
ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_date TEXT;
```

Existing rows will have `NULL` → ignored by the feed query.

---

### 2. Models

#### [MODIFY] [index.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/models/index.ts)

- Add `user_date?: string` to `IHabit`.
- Add new interface:
```ts
export interface IShareEvent {
  id?: string;
  ownerid: string;
  recipientid: string;
  habitids: string[];
  user_date: string;
  created_at: Date;
}
```

#### [MODIFY] [useHabitsApi.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/app/composables/useHabitsApi.ts)

- Add `user_date?: string` to the frontend `Habit` interface.

---

### 3. Habit Creation (Trigger 3.1)

#### [MODIFY] [app/pages/index.vue](file:///c:/Users/Dwayne/Documents/Projects/habits-social/app/pages/index.vue)

In `addHabit` (~line 1175), pass user's local date:
```ts
user_date: format(new Date(), 'yyyy-MM-dd')
```

#### [MODIFY] [server/api/habits/index.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/api/habits/index.ts)

In the POST handler, read `body.user_date` and include it in the INSERT:
```sql
INSERT INTO habits (..., user_date) VALUES (..., ${body.user_date || null})
```

---

### 4. Habit Sharing (Trigger 3.2)

Three entry points — all must create `share_events` rows:

#### Entry Point A: Batch share from social page

**[MODIFY] [app/pages/social.vue](file:///c:/Users/Dwayne/Documents/Projects/habits-social/app/pages/social.vue)**

In `executeBatchShare` (~line 954), pass `user_date`:
```ts
body: { targetUserId, habitIds, user_date: format(new Date(), 'yyyy-MM-dd') }
```

**[MODIFY] [server/api/social/share-habits.post.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/api/social/share-habits.post.ts)**

After updating habit `sharedwith` arrays, insert a single `share_events` row:
```sql
INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
VALUES (${userId}, ${targetId}, ${actuallySharedIds}, ${user_date}, NOW())
```
Only include habit IDs that were *actually* newly shared (i.e., the UPDATE affected them).

#### Entry Point B: Editing sharing from dashboard

**[MODIFY] [app/pages/index.vue](file:///c:/Users/Dwayne/Documents/Projects/habits-social/app/pages/index.vue)**

In `updateHabit` (~line 1366), pass `user_date`:
```ts
user_date: format(new Date(), 'yyyy-MM-dd')
```

**[MODIFY] [server/api/habits/[id].ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/api/habits/%5Bid%5D.ts)**

In the PUT handler, compare old vs new `sharedwith`. For each **new** recipient, insert a `share_events` row with `habitids = [this habit's id]`:
```sql
INSERT INTO share_events (ownerid, recipientid, habitids, user_date, created_at)
VALUES (${userId}, ${newRecipientId}, ARRAY[${habitId}::uuid], ${user_date}, NOW())
```

---

### 5. Feed Aggregation

#### [MODIFY] [server/api/social/feed.get.ts](file:///c:/Users/Dwayne/Documents/Projects/habits-social/server/api/social/feed.get.ts)

Expand the feed with two additional queries (separate from the habitlogs query, then merged/sorted in JS):

**Query 2: Commitments** (Trigger 3.1)
```sql
SELECT h.id, h.ownerid, h.user_date as date, h."createdAt" as updatedat,
       h.title as "habitTitle", h.sharedwith,
       u.username, u.photourl
FROM habits h
JOIN users u ON h.ownerid::uuid = u.id
WHERE h.user_date IS NOT NULL
  AND (
    (h.ownerid::text = ANY(${friendIds}) AND ${userId}::text = ANY(h.sharedwith))
    OR h.ownerid::text = ${userId}::text
  )
ORDER BY h.user_date DESC, h."createdAt" DESC
LIMIT 100
```

**Query 3: Share Events** (Trigger 3.2)
```sql
SELECT se.id, se.ownerid, se.recipientid, se.habitids,
       se.user_date as date, se.created_at as updatedat,
       u.username, u.photourl,
       ru.username as recipient_username
FROM share_events se
JOIN users u ON se.ownerid::uuid = u.id
JOIN users ru ON se.recipientid::uuid = ru.id
WHERE (
    (se.ownerid::text = ANY(${friendIds}) AND se.recipientid::text = ${userId}::text)
    OR se.ownerid::text = ${userId}::text
  )
ORDER BY se.user_date DESC, se.created_at DESC
LIMIT 100
```

For share events, we also need to fetch habit titles for the referenced `habitids`:
```sql
SELECT id, title FROM habits WHERE id = ANY(${allHabitIds}::uuid[])
```

**Narrator logic for new types:**

| Type | Condition | Message |
|------|-----------|---------|
| `COMMITMENT` | habit creation | `committed to a new habit: ${habitTitle} on ${dateFormatted}.` |
| `SHARE` (1 habit, viewer is owner) | single habit shared | `shared ${habitTitle} with ${recipientName} on ${dateFormatted}.` |
| `SHARE` (N habits, viewer is owner) | multi habit shared | `shared ${count} habits with ${recipientName} on ${dateFormatted}.` |
| `SHARE` (1 habit, viewer is recipient) | single habit shared | `shared ${habitTitle} with you on ${dateFormatted}.` |
| `SHARE` (N habits, viewer is recipient) | multi habit shared | `shared ${count} habits with you on ${dateFormatted}.` |

**Feed item shape for new types:**

```ts
{
  id: string,
  type: 'COMMITMENT' | 'SHARE',
  user: { id, name, photoUrl },
  habit: { id, title },          // for COMMITMENT
  habits: [{ id, title }, ...],  // for SHARE (array of shared habits)
  message: string,
  date: string,
  timestamp: Date
}
```

**Merge & sort** all three result sets in JS, then slice to 100.

---

### 6. Frontend UI

#### [MODIFY] [app/pages/social.vue](file:///c:/Users/Dwayne/Documents/Projects/habits-social/app/pages/social.vue)

**Icon imports** (~line 553): Add `Target`, `Share2`.

**Icon/color mapping** (~lines 98-117):

| Type | Icon | Color |
|------|------|-------|
| `COMMITMENT` | `Target` | Indigo (`bg-indigo-500/10 border-indigo-500/20 text-indigo-500`) |
| `SHARE` | `Share2` | Sky (`bg-sky-500/10 border-sky-500/20 text-sky-500`) |

**Subtitle row** (~line 91-93): For `SHARE` events with multiple habits, display comma-separated habit titles in the subtitle. For `COMMITMENT`, display the single habit title as usual.

**Click behavior**: 
- `COMMITMENT` → `openHabitDetails(item.habit.id)` (same as existing)
- `SHARE` (1 habit) → `openHabitDetails(item.habits[0].id)` 
- `SHARE` (N habits) → no-op (or maybe just do nothing / show first habit)

---

## Summary of All Files Changed

| File | Change |
|------|--------|
| DB migration (manual SQL) | `CREATE TABLE share_events`, `ALTER TABLE habits ADD COLUMN user_date` |
| `server/models/index.ts` | Add `user_date` to `IHabit`, add `IShareEvent` |
| `app/composables/useHabitsApi.ts` | Add `user_date` to `Habit` |
| `server/api/habits/index.ts` | Store `user_date` on creation |
| `server/api/habits/[id].ts` | Detect new recipients → insert `share_events` |
| `server/api/social/share-habits.post.ts` | Insert grouped `share_events` on batch share |
| `server/api/social/feed.get.ts` | Additional queries + narrator logic for Cat 3 |
| `app/pages/index.vue` | Pass `user_date` on create + sharing update |
| `app/pages/social.vue` | Pass `user_date` on batch share, add icons for new types |

## Verification Plan

### Manual Verification
1. **Create habit (no friends)** → "You committed to..." appears in YOUR feed only
2. **Create habit (with friends)** → commitment appears in your feed AND friend's feed
3. **Batch share 3 habits** → single "shared 3 habits with [Friend]" event
4. **Batch share 1 habit** → "shared Morning Workout with [Friend]" event
5. **Edit sharing from dashboard** → share event for each new recipient
6. **Feed sorting** → commitment/share events sort correctly alongside habit logs
7. **Click commitment card** → habit detail modal opens
8. **Click single-habit share card** → habit detail modal opens
