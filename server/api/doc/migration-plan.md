# V1 → V2 API Promotion Plan

Archive V1 into `_v1/`. Promote V2 to `server/api/`. V2's infrastructure (`_utils`, `_types`, `_tests`) promotes to `server/` level — no underscores.

## Guiding Principles

1. **V1 code stays untouched** — only import paths change (necessary when files move).
2. **V2's infrastructure promotes to `server/`** — `utils/`, `types/`, `tests/` live at root server level, outside Nitro's `api/` route scanning. No underscore prefixes needed.
3. **Frontend will break** — separate task for later.

---

## Final Directory Structure

```
server/
├── utils/             ← V2 utils (from v2/_utils/ — Nitro auto-imports these)
│   ├── auth.ts
│   ├── buckets.ts
│   ├── db.ts
│   ├── normalize.ts
│   ├── shared-buckets.ts
│   ├── streaks.ts
│   ├── transform.ts
│   └── validation.ts
├── types/             ← V2 types (from v2/_types/)
├── tests/             ← V2 tests (from v2/_tests/)
├── api/
│   ├── _v1/           ← Archived V1 (underscore = hidden from Nitro = offline)
│   │   ├── _utils/    ← Old server/utils/ (V1's legacy utilities)
│   │   ├── _models/   ← Old server/models/
│   │   ├── auth/
│   │   ├── habits/
│   │   ├── habitlogs/
│   │   ├── buckets/
│   │   ├── bucketlogs/
│   │   ├── social/
│   │   ├── sync.ts
│   │   └── README.md
│   ├── auth/          ← V2 auth endpoints (live routes)
│   ├── habits/        ← V2 habits
│   ├── habitlogs/     ← V2 habitlogs
│   ├── buckets/       ← V2 buckets
│   ├── bucketlogs/    ← V2 bucketlogs
│   ├── friendships/   ← V2 friendships
│   ├── social/        ← V2 social
│   ├── users/         ← V2 users
│   ├── doc/           ← V2 documentation
│   ├── scratch/
│   ├── production-readiness-review.md
│   └── README.md
├── testing/           ← Legacy debug script (leave alone)
```

---

## Execution Steps

### Step 1: Archive V1

#### 1a. Move old utilities and models into `_v1/`
- `server/utils/*` → `server/api/_v1/_utils/`
- `server/models/*` → `server/api/_v1/_models/`

#### 1b. Move V1 endpoints into `_v1/`
- `server/api/auth/` → `server/api/_v1/auth/`
- `server/api/habits/` → `server/api/_v1/habits/`
- `server/api/habitlogs/` → `server/api/_v1/habitlogs/`
- `server/api/buckets/` → `server/api/_v1/buckets/`
- `server/api/bucketlogs/` → `server/api/_v1/bucketlogs/`
- `server/api/social/` → `server/api/_v1/social/`
- `server/api/sync.ts` → `server/api/_v1/sync.ts`

#### 1c. Fix V1 import paths (path-only, zero logic changes)

| Old Import | New Import | Files |
|---|---|---|
| `../../utils/pusher` | `./_utils/pusher` | 6 files |
| `../../utils/buckets` | `./_utils/buckets` | 3 files |
| `../../utils/streaks` | `./_utils/streaks` | 1 file |
| `../../utils/shared-buckets` | `./_utils/shared-buckets` | 2 files |
| `../../utils/db` | `./_utils/db` | 1 file |
| `../../utils/auth` | `./_utils/auth` | 1 file |
| `../../models` | `./_models` | 10 files |
| `../utils/normalize` | `./_utils/normalize` | 1 file (sync.ts) |

#### 1d. Create deprecation notice

**[NEW]** `server/api/_v1/README.md`

---

### Step 2: Promote V2 infrastructure to `server/`

| Current Path | New Path |
|---|---|
| `server/api/v2/_utils/*` | `server/utils/*` |
| `server/api/v2/_types/*` | `server/types/*` |
| `server/api/v2/_tests/*` | `server/tests/*` |

No underscores. These directories are outside `server/api/` so Nitro ignores them entirely.

---

### Step 3: Promote V2 endpoints to `server/api/`

| Current Path | New Path |
|---|---|
| `server/api/v2/auth/` | `server/api/auth/` |
| `server/api/v2/habits/` | `server/api/habits/` |
| `server/api/v2/habitlogs/` | `server/api/habitlogs/` |
| `server/api/v2/buckets/` | `server/api/buckets/` |
| `server/api/v2/bucketlogs/` | `server/api/bucketlogs/` |
| `server/api/v2/friendships/` | `server/api/friendships/` |
| `server/api/v2/social/` | `server/api/social/` |
| `server/api/v2/users/` | `server/api/users/` |
| `server/api/v2/doc/` | `server/api/doc/` |
| `server/api/v2/scratch/` | `server/api/scratch/` |
| `server/api/v2/production-readiness-review.md` | `server/api/production-readiness-review.md` |
| `server/api/v2/README.md` | `server/api/README.md` |

---

### Step 4: Update V2 import paths

#### V2 endpoint files (in `server/api/<module>/`)

Utils moved from `../_utils/` to `../../utils/`:

| Old Import | New Import |
|---|---|
| `../_utils/db` | `../../utils/db` |
| `../_utils/auth` | `../../utils/auth` |
| `../_utils/normalize` | `../../utils/normalize` |
| `../_utils/validation` | `../../utils/validation` |
| `../_utils/buckets` | `../../utils/buckets` |
| `../_utils/streaks` | `../../utils/streaks` |
| `../_utils/shared-buckets` | `../../utils/shared-buckets` |

For nested files (e.g., `users/[id]/profile.get.ts`):

| Old Import | New Import |
|---|---|
| `../../_utils/db` | `../../../utils/db` |
| `../../_utils/auth` | `../../../utils/auth` |

#### V2 test files (in `server/tests/`)

Tests moved from `server/api/v2/_tests/` to `server/tests/`. Utils moved from `server/api/v2/_utils/` to `server/utils/`:

| Old Import | New Import |
|---|---|
| `../_utils/validation` | `../utils/validation` |
| `../_utils/streaks` | `../utils/streaks` |
| `../_utils/buckets` | `../utils/buckets` |

#### V2 internal util cross-references (within `server/utils/`)

| Old Import | New Import |
|---|---|
| `./buckets` | `./buckets` (unchanged — same directory) |
| `./transform` | `./transform` (unchanged) |

No changes needed for internal util imports.

---

### Step 5: Update README

Remove "⚠️ ISOLATED PROJECT" warnings. Update to reflect V2 as the primary API.

---

### Step 6: Clean up empty directories

- Delete empty `server/api/v2/`
- Delete empty `server/utils/` (contents moved to `_v1/_utils/`)
- Delete empty `server/models/` (contents moved to `_v1/_models/`)

---

## Summary of Code Changes

| Area | Change Type | Lines |
|---|---|---|
| V1 endpoints | Import path fixes only | ~17 |
| V1 logic | None | 0 |
| V2 endpoints | Import path fixes only | ~40 |
| V2 tests | Import path fixes only | ~6 |
| V2 logic | None | 0 |
| New files | `_v1/README.md` | 1 |
| Modified | `server/api/README.md` | 1 |

---

## Verification Plan

### Automated Tests
- `npx vitest run server/tests/` — V2 tests at new path (68/68 expected)

### Build Check
- `npm run build` — Nitro generates routes correctly from promoted V2

### Route Verification
- V2 endpoints respond at `/api/auth/login`, `/api/habits`, etc.
- Old V1 routes return 404 (offline behind `_v1/` underscore)
