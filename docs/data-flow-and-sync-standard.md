# Data Flow and Synchronization Standard

This document outlines the architectural standard for data flow, state management, and synchronization across the application. It specifically focuses on the relationship between habits, habit logs, buckets, and bucket logs.

## 1. Core Principle: Local-First (Optimistic UI)
The application strictly follows a local-first paradigm to ensure a zero-latency user experience and true offline capability. 

### Local Settlement 
All user interactions MUST settle completely in the local database (Dexie) before any network requests are initiated.
*   **Root Updates:** When a user performs an action (e.g., logging a habit), the primary record in Dexie is updated immediately.
*   **Cascading Updates:** Any dependent entities must also be updated locally and instantaneously. For example, if logging a habit affects the progress or streak of a related bucket, the client must calculate this change and update the bucket's local record in Dexie immediately. This enforces strict consistency between local and server calculation logic.
*   **UI Binding:** The user interface MUST strictly bind to the local Dexie database. The UI updates instantly as a direct result of the local settlement.

## 2. Server Synchronization (Neon)
The server acts as the ultimate source of truth for the system, validating and persisting changes.

### Background Pushing
*   Only after all local dependencies have settled in Dexie should the sync engine queue the root action to be pushed to the server.
*   The client pushes the *root action* (e.g., the habit log), relying on the server to handle its own cascading calculations (e.g., recalculating the bucket streak).

### Hybrid Server Validation & Storage
*   **Server Calculation:** Upon receiving the sync request, the server executes its own logic to process the root action and calculates derived data (like bucket streaks) to store in Neon. This ensures the database has fully calculated state ready for fast queries, feeds, and analytics.
*   **Initiating Client Trust:** The client that initiated the push trusts its own local calculations and generally *ignores* the server's calculated response to avoid redundant database writes or UI jitter. It only relies on the server's response if it needs conflict resolution.

## 3. Real-time Synchronization across Sessions (Pusher)
To maintain consistency across multiple devices and sessions, the application uses real-time push events.

### Post-Settlement Broadcasting
*   The server MUST NOT fire push events during intermediate steps or partial updates.
*   Push events (via Pusher) should only be triggered *after* the entire sync operation has settled down in the Neon database (i.e., after the root action and all cascading entity updates are successfully committed).
*   This prevents race conditions where a secondary device receives a push event and pulls incomplete data before the server has finished calculating secondary effects (like bucket streaks).

### Actionable Pushes
*   When a secondary session/device receives a push event, it treats it as a signal to perform a background pull synchronization, bringing its local Dexie database up to date with the server's authoritative state.

## 4. Optimized Data Retrieval (Pull Sync)
To preserve bandwidth and ensure fast local database settlement, pull operations must be heavily optimized.

*   **Absolute Minimum Data:** The client must never perform full data wipes or blind bulk fetches. A pull request should only request the absolute minimum data required to reconcile the local state.
*   **Delta Fetching:** Whenever possible, clients should pass a "last synced" timestamp or specific entity IDs in their pull requests. The server should respond *only* with the delta (records modified since that timestamp or matching those IDs).
*   **Pulling Pre-Calculated State:** Secondary devices (or the same user pulling after being offline) *will* pull the server's pre-calculated derived data (e.g., the updated bucket streaks). This prevents every client from having to redundantly calculate state from raw events, saving CPU and ensuring strict consistency across devices.
*   **Targeted Re-calculation:** When the client receives the delta, it merges the changes into Dexie and only triggers re-calculations (e.g., UI refreshes) for the specific entities affected by the delta.

## 5. Implementation Roadmap (Checklist)
To fully comply with this standard, the following refactoring steps must be performed on the codebase:

### Client-Side (`app/composables/useHabitsApi.ts` & `app/utils/db.ts`)
- [ ] Port the server-side bucket streak calculation logic (e.g., `recalculateBucketStreak`) to a client-side Dexie utility.
- [ ] Update client-side functions (`createHabit`, `updateHabit`, `upsertLog`, etc.) to trigger cascading local updates to `buckets` and `bucketLogs` in Dexie before returning.
- [ ] Refactor the background `sync` function so that initiating clients ignore the server response for calculated fields, unless conflict resolution is needed.
- [ ] Update the `sync` function's pull mechanism to request and merge only delta updates (using timestamps or IDs).

### Server-Side (`server/api/**/*.ts` & `server/utils/buckets.ts`)
- [ ] Ensure that API endpoints only return the hybrid validation response.
- [ ] Relocate all Pusher event triggers (`pusher.trigger`) inside API endpoints so they only fire at the very end of the controller, *after* the root action and all `recalculateBucketStreak` database operations have successfully settled.
- [ ] Consolidate specific Pusher events (like `bucket-updated`) into a broader `sync-settled` or delta-specific event to prompt client pulls cleanly.
- [ ] Ensure pull endpoints (e.g., `GET /api/habits`, `GET /api/buckets`) support delta fetching via `lastSynced` timestamp query parameters.