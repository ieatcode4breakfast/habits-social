# Habit Logging and Synchronization

This document describes the technical implementation and synchronization logic for habit logs within the platform.

## 1. Data Structure

### Deterministic Identifiers
Habit logs use a deterministic ID format to prevent duplicate entries for the same activity:
*   **Format:** `${habitId}_${date}` (e.g., `550e8400-e29b-41d4-a716-446655440000_2024-02-27`)
*   **Rationale:** This ensures that regardless of which device creates a log, they will always refer to the same logical record on the server.

### State-Based Recording
Habit logs are **state-based**, not event-based.
*   **No Audit Log:** We do not store a history of changes (e.g., "changed from Skip to Complete"). We only store the *current* status for a specific habit on a specific date.
*   **Intermediate Discarding:** If a user toggles a habit status multiple times while offline, only the final status is saved locally and eventually synced.

## 2. Conflict Resolution Strategy

The system employs a **Last-Push-Wins (LPW)** strategy combined with **Local Stickiness**.

### Server-Side: Last-Push-Wins
The server treats the most recent incoming request as the definitive truth.
*   **Implementation:** The server uses PostgreSQL `ON CONFLICT (id) DO UPDATE` to overwrite existing logs.
*   **Clock Authority:** The server uses its own system clock (`updated_at = NOW()`) to timestamp the record, ignoring client-side timestamps for resolution.
*   **Outcome:** If Device A pushes "Fail" and then Device B pushes "Complete," the server will hold "Complete."

### Client-Side: Local Stickiness
To prevent the UI from "flickering" or reverting during a sync, the client prioritizes its own unsynced changes.
*   **Reconciliation Rule:** During a Pull synchronization, if a remote log is received for an ID that has a local **unsynced** change (`synced: 0`), the client **ignores** the remote data.
*   **Precedence:** Local intent always takes precedence over server state until that local intent is successfully acknowledged by the server.

## 3. Synchronization Flow

### Push Phase (Client to Server)
*   **Granularity:** Currently, updates are sent as **individual HTTP requests** per log.
*   **Ordering:** Updates are processed sequentially. The client waits for a success response before pushing the next unsynced log in the queue.
*   **Robustness:** If a push fails with a 409 Conflict (e.g., ownership mismatch), the client marks the log as synced to stop the retry loop, assuming the server's state is authoritative for that record.

### Pull Phase (Server to Client)
*   **Delta Sync:** Clients request logs modified since their `lastSynced` timestamp.
*   **Merging:** Received logs are merged into the local Dexie database unless the "Local Stickiness" rule applies.

## 4. Derived Data Cascades

A habit log update is a **Root Action** that triggers several automatic calculations on the server:
1.  **Streak Calculation:** The server recalculates the current and longest streaks for the habit.
2.  **Bucket Evaluation:** The server identifies all Buckets containing that habit and recalculates the status and streaks for those buckets on the affected date.
3.  **Real-time Notification:** Once all calculations are settled, a Pusher event is emitted to other active sessions to trigger a background delta-sync.
