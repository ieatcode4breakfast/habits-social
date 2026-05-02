# Data Schema Documentation

This document outlines the data structures used in the Habits Social application across the client-side (local Dexie DB) and server-side (PostgreSQL).

## Core Entities

### Habit
Represents a recurring task or behavior a user intends to track.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (UUID). |
| `ownerid` | `string` | ID of the user who owns the habit. |
| `title` | `string` | Name of the habit. |
| `description` | `string` | Optional details or notes. |
| `frequencyCount` | `number` | Required completions per period (e.g., **1**). |
| `frequencyPeriod` | `string` | Time window for frequency (`daily`, `weekly`, `monthly`). |
| `color` | `string` | UI theme color identifier or hex code. |
| `sharedwith` | `string[]` | List of User IDs this habit is shared with. |
| `sortOrder` | `number` | Manual sorting position in the dashboard. |
| `currentStreak` | `number` | Cached value of the current active streak. |
| `longestStreak` | `number` | Historical peak streak value. |
| `streakAnchorDate`| `Date/string` | The reference date for calculating the current streak. |
| `user_date` | `string` | The user's local date when the habit was created (ISO format). |
| `createdAt` | `Date` | System timestamp of creation. |
| `updatedat` | `Date` | System timestamp of the last modification. |

### HabitLog
A record of a specific instance of a habit being completed, skipped, or failed.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (Composite: `${habitid}_${date}`). |
| `habitid` | `string` | Reference to the parent Habit. |
| `ownerid` | `string` | ID of the user who performed the action. |
| `date` | `string` | The calendar date of the log (`YYYY-MM-DD`). |
| `status` | `string` | Result of the habit (`completed`, `skipped`, `failed`). |
| `streakCount` | `number` | The streak value recorded at the moment of this log. |
| `sharedwith` | `string[]` | Users who have visibility into this specific event. |

---

## Buckets (Habit Groups)

Buckets allow users to group multiple habits and track a collective "meta-streak".

### Bucket
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier. |
| `ownerid` | `string` | ID of the user who owns the bucket. |
| `title` | `string` | Name of the bucket. |
| `description` | `string` | Optional context for the group. |
| `habitIds` | `string[]` | (Client-side) IDs of habits associated with this bucket. |
| `currentStreak` | `number` | Collective streak based on bucket completion rules. |
| `longestStreak` | `number` | Historical peak for the bucket. |
| `streakAnchorDate`| `Date/string` | Reference date for bucket streak calculation. |
| `sortOrder` | `number` | Position in the "Buckets" view. |

---

## Social & Synchronization

### ShareEvent
Logs the event of a user sharing specific habits with another user.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Event identifier. |
| `ownerid` | `string` | User who shared the habits. |
| `recipientid` | `string` | User who received the share. |
| `habitids` | `string[]` | The specific habits included in this share event. |
| `user_date` | `string` | The local date of the sharing action. |

### Friendship
Manages the social graph between users.

| Field | Type | Description |
| :--- | :--- | :--- |
| `initiatorId` | `string` | User who sent the friend request. |
| `receiverId` | `string` | User who received the request. |
| `status` | `string` | State of the friendship (`pending`, `accepted`). |
| `initiatorFavorite`| `boolean` | Whether the initiator pinned this friend. |
| `receiverFavorite` | `boolean` | Whether the receiver pinned this friend. |

---

## Local Sync Metadata (Dexie)
When stored in the local IndexedDB via Dexie, entities include synchronization flags:

*   **`synced`**: (0 or 1) Indicates if the local change has been successfully pushed to the server.
*   **`updatedAt`**: (number) Unix timestamp of the last local update, used for "Last-Write-Wins" conflict resolution during sync.
