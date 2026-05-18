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

### Server-Side Cascades
*   The server is responsible for any secondary data mutations that must happen automatically (e.g., updating a bucket's streak when a contained habit log is added).
*   **Social & Deletion Cascades**: When a sharing relationship is severed (e.g., unfriending, revoking habit sharing) or an entity is deleted, the server must perform a cascade to maintain data integrity. For example:
    *   Unfriending must mark all cross-owned bucket habits as `'removed'`.
    *   Deleting a habit must physically remove it from all buckets and trigger bucket streak re-evaluations.

### Performance: Set-Based vs. Procedural Processing
The server must strictly avoid **Procedural Processing** (the "Loop-and-Query" anti-pattern).

*   **The Anti-Pattern (Procedural):** Fetching a list of records in TypeScript, looping through them, and executing individual `db.insert` or `db.update` calls. This transforms a single user action into $N$ network round-trips, causing connection pool exhaustion and API timeouts as user history grows.
*   **The Standard (Set-Based):** All bulk operations must be handed to the database as a single logical unit. 
    *   **Batch Operations:** Use Drizzle's batching APIs (`db.insert(...).values([...])`) for creating or updating multiple related records (e.g., assigning 20 habits to a bucket).
    *   **Bulk Aggregation (SQL-Native):** For complex re-evaluations (like recalculating a bucket's entire history), use a single `INSERT ... SELECT` query with Postgres aggregation functions. Let the database engine do the heavy lifting of joining and counting instead of pulling raw data into TypeScript for processing.
*   **Rationale:** The primary bottleneck is Network Round-Trip Time (RTT). A single complex query is always faster and safer than sequential queries.

### Hybrid Server Validation & Storage
*   **Server Calculation:** Upon receiving the sync request, the server executes its own logic to process the root action and calculates derived data (like bucket streaks) to store in Neon. This ensures the database has fully calculated state ready for fast queries, feeds, and analytics.
*   **Initiating Client Trust:** The client that initiated the push trusts its own local calculations and generally *ignores* the server's calculated response to avoid redundant database writes or UI jitter. It only relies on the server's response if it needs conflict resolution.

## 3. Optimized Data Retrieval (Pull Sync)
To preserve bandwidth and ensure fast local database settlement, pull operations must be heavily optimized.

*   **Absolute Minimum Data:** The client must never perform full data wipes or blind bulk fetches. A pull request should only request the absolute minimum data required to reconcile the local state.
*   **Delta Fetching:** Whenever possible, clients should pass a "last synced" timestamp in their pull requests. The server should respond *only* with the delta (records modified since that timestamp).
*   **Pulling Pre-Calculated State:** Secondary devices (or the same user pulling after being offline) *will* pull the server's pre-calculated derived data (e.g., the updated bucket streaks). This prevents every client from having to redundantly calculate state from raw events, saving CPU and ensuring strict consistency across devices.
*   **Targeted Re-calculation:** When the client receives the delta, it merges the changes into Dexie and only triggers re-calculations (e.g., UI refreshes) for the specific entities affected by the delta.

## 4. End-to-End Data Flow Sequence
To summarize the standard, the lifecycle of a single user action follows this sequence:

1. **User Interaction:** The user performs an action (e.g., logging a habit completion).
2. **Local Settlement:** The local database instantly records the root action and calculates any immediate cascading effects (e.g., updating a related bucket's local progress). The UI updates immediately without waiting for a network response.
3. **Background Push:** The client silently queues and sends the root action to the server in the background.
4. **Server Validation & Storage:** The server receives the action, validates it, and performs its own authoritative cascading calculations. The finalized state is stored in the primary remote database.
5. **Reconciliation:** Secondary sessions merge new data into their local database when they perform a pull sync (e.g., on manual refresh or page reload).