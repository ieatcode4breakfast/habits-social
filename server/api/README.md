# Habits Social API

Primary backend API for the Habits Social application.

## Directory Structure

```
server/
├── utils/        ← Runtime utilities (db, auth, transform, streaks).
├── types/        ← TypeScript types/interfaces.
├── tests/        ← Vitest test suites and setup.
├── api/
│   ├── auth/          ← Authentication endpoints (login, register).
│   ├── habits/        ← Habit management endpoints.
│   ├── habitlogs/     ← Habit logging and streak tracking.
│   ├── buckets/       ← Bucket management and reordering.
│   ├── bucketlogs/    ← Automatic bucket log aggregation.
│   ├── friendships/   ← Social graph and friend requests.
│   ├── social/        ← Social feed and habit sharing.
│   ├── users/         ← User profile and search.
│   ├── doc/           ← API documentation.
│   ├── _v1/           ← Archived legacy API (offline).
│   └── README.md      ← This file.
```

## Architecture

- **Endpoints**: Defined in `server/api/` using Nitro's file-based routing.
- **Utilities**: Shared logic lives in `server/utils/`.
- **Types**: Shared TypeScript interfaces in `server/types/`.
- **Testing**: Vitest suites in `server/tests/`.

## Verification

Run all API tests:
```bash
npx vitest run server/tests/
```
