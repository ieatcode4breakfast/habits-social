# Bucket Log Aggregation Logic

This document defines the single source of truth for how a "Bucket" status is determined based on the statuses of its constituent habits for a given day.

## 1. Status Priority (Deterministic Order)

A Bucket's status for a specific date is calculated by evaluating the statuses of all assigned habits. The first condition that matches determines the final status.

| Priority | Bucket Status | Condition |
| :--- | :--- | :--- |
| **1** | `cleared` | At least one habit in the bucket is missing a log (or is explicitly set to `cleared`). |
| **2** | `completed` | At least one habit in the bucket is marked as `completed`. |
| **3** | `failed` | EVERY habit in the bucket is marked as `failed` (100% failure rate). |
| **4** | `skipped` | The total number of `skipped` habits is greater than or equal to `vacation` habits. |
| **5** | `vacation` | Fallback condition: There are strictly more `vacation` habits than `skipped` habits. |

## 2. Aggregation Rules

### Inclusion Criteria
*   A habit is considered "missing" (Priority 1) if no log exists for that specific date or if the log status is explicitly `cleared`.

### Streak Impact
The resulting bucket status directly influences the bucket's streak calculation:
*   `completed`: Increments the streak.
*   `vacation` / `skipped`: Protects the streak (maintains current count without incrementing).
*   `failed`: Breaks the streak immediately (resets to 0).
*   `cleared`: Creates a gap in the timeline, which typically results in a streak reset during the next valid log evaluation.

## 3. Implementation Consistency

This logic must be maintained identically across:
1.  **Backend (PostgreSQL/Drizzle)**: Triggered during bulk reevaluations or habit log updates.
2.  **Frontend (Dexie/TypeScript)**: Triggered for optimistic UI updates before synchronization.
