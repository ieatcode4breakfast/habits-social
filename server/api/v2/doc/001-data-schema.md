# Data Schema Documentation

This document outlines the data structures used in the Habits Social application across the client-side (local Dexie DB) and server-side (PostgreSQL).

## Core Entities

### User
Represents a registered user of the application.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (UUID). |
| `email` | `string` | User's email address. |
| `username` | `string` | User's chosen display name. |
| `passwordHash` | `string` | Hashed password. |
| `photourl` | `string` | Optional URL to the user's avatar/profile picture. |
| `emailVerifiedAt` | `Date` | Optional timestamp indicating when the email was verified. |
| `createdAt` | `Date` | System timestamp of creation. |
| `updatedAt` | `Date` | System timestamp of the last modification. |

### Habit
Represents a recurring task or behavior a user intends to track.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (UUID). |
| `ownerid` | `string` | ID of the user who owns the habit. |
| `title` | `string` | Name of the habit. |
| `description` | `string` | Optional details or notes. |
| `skipsCount` | `number` | Allowed skips per period (e.g., **2**). |
| `skipsPeriod` | `string` | Time window for skips (`weekly`, `monthly`). |
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
| `status` | `string` | Result of the habit (`completed`, `skipped`, `failed`, `cleared`). |
| `streakCount` | `number` | The streak value recorded at the moment of this log. |
| `brokenStreakCount`| `number` | Optional. If this log broke a streak, the length of the streak broken. |
| `sharedwith` | `string[]` | Users who have visibility into this specific event. |
| `updatedat` | `Date` | System timestamp of the last modification. |

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
| `color` | `string` | Optional UI theme color identifier or hex code. |
| `habitIds` | `string[]` | (Client-side) IDs of habits associated with this bucket. |
| `currentStreak` | `number` | Collective streak based on bucket completion rules. |
| `longestStreak` | `number` | Historical peak for the bucket. |
| `streakAnchorDate`| `Date/string` | Reference date for bucket streak calculation. |
| `sortOrder` | `number` | Position in the "Buckets" view. |
| `createdAt` | `Date` | System timestamp of creation. |
| `updatedat` | `Date` | System timestamp of the last modification. |

### BucketHabit (Join Table)
| Field | Type | Description |
| :--- | :--- | :--- |
| `bucket_id` | `uuid` | Reference to Bucket. |
| `habit_id` | `uuid` | Reference to Habit. |
| `added_by` | `uuid` | User who added the habit. |
| `approval_status` | `string` | Status for shared buckets (`pending`, `accepted`, `declined`, `removed`). |

### SharedBucketMember
| Field | Type | Description |
| :--- | :--- | :--- |
| `bucket_id` | `uuid` | Reference to Bucket. |
| `user_id` | `uuid` | Reference to User. |
| `status` | `string` | Membership status (`pending`, `accepted`, `declined`). |
| `created_at` | `Date` | |
| `updated_at` | `Date` | |

### BucketLog
A record of a bucket's status for a specific date based on its habits.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (Composite: `${bucketid}_${date}`). |
| `bucketid` | `string` | Reference to the parent Bucket. |
| `ownerid` | `string` | ID of the user who owns the bucket. |
| `date` | `string` | The calendar date of the log (`YYYY-MM-DD`). |
| `status` | `string` | Result of the bucket (`completed`, `skipped`, `failed`, `cleared`). |
| `streakCount` | `number` | The streak value recorded at the moment of this log. |
| `brokenStreakCount`| `number` | Optional. If this log broke a streak, the length of the streak broken. |
| `updatedat` | `Date` | System timestamp of the last modification. |

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
| `created_at` | `Date` | System timestamp of creation. |

### Friendship
Manages the social graph between users.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier. |
| `initiatorId` | `string` | User who sent the friend request. |
| `receiverId` | `string` | User who received the request. |
| `status` | `string` | State of the friendship (`pending`, `accepted`). |
| `initiatorFavorite`| `boolean` | Whether the initiator pinned this friend. |
| `receiverFavorite` | `boolean` | Whether the receiver pinned this friend. |
| `createdAt` | `Date` | System timestamp of creation. |
| `updatedAt` | `Date` | System timestamp of the last modification. |

### Sync Deletion (Tombstones)
Records when an entity is deleted on the server so that other devices can catch up during a delta sync.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (UUID). |
| `ownerid` | `string` | ID of the user who performed the deletion. |
| `entity_id` | `string` | The ID of the habit or bucket that was deleted. |
| `entity_type` | `string` | The type of entity (`habit`, `bucket`). |
| `created_at` | `Date` | System timestamp of the deletion. |

---

## Local Sync Metadata (Dexie)
When stored in the local IndexedDB via Dexie, entities include synchronization flags:

*   **`synced`**: (0, 1, or -1) Indicates if the local change has been successfully pushed to the server. (0: New/unsynced, 1: Synced, -1: Updated but unsynced).
*   **`updatedAt`**: (number) Unix timestamp of the last local update, used for "Last-Write-Wins" conflict resolution during sync.
*   **Tombstone Reconciliation**: During the sync process, the client fetches any relevant `Sync Deletion` records from the server and purges the corresponding local entities from Dexie.
