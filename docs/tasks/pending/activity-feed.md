# Habit Tracking Feed & Milestone Logic (Not Yet Implemented in Codebase)

This document outlines the logic, formatting rules, and trigger events for the habit tracking activity feed. It is designed to reward consistency, prevent notification fatigue, and clearly communicate habit progress between friends.

## 1. Milestone Days & Core Rules

### Standard Milestones

Milestones are triggered on the following streak days:
**2, 3, 4, 5, 7, 14, 21, 30, 60, 90, 100, 180, 300, Annual** (every 365 days).

### The Veteran Habit Rule

For habits that have previously reached a 365-day streak, any new streaks will skip the early milestones (2, 3, 4, and 5 days) to prevent spam. The first milestone notification for these habits will start at **7 days**.

### Post-Year Formatting Rule

Everything starting at 365 days must be explicitly formatted to show the years and days, followed by the total days in parentheses.

- *Example:* 1-year and 20-day streak (385 days)

---

## 2. Activity Feed Triggers

### CATEGORY 1: INITIAL & ISOLATED LOGS

*Triggers for the first log of a potential streak (Day 1) or actions taken when no active streak exists.*

- **Trigger: Initial Completion (Day 1)**
    - **Content**: The very first completion for a habit that has no prior streak history.
    - **Your Activity**: You completed Morning Workout for Apr 27.
    - **Friend Activity**: Alex completed Morning Workout for Apr 27.
- **Trigger: Initial Skip**
    - **Content**: Marking a habit as skipped when no active streak exists.
    - **Your Activity**: You skipped No Sugar for Apr 27.
    - **Friend Activity**: Taylor skipped No Sugar for Apr 27.
- **Trigger: Initial Failure**
    - **Content**: Marking a habit as failed when no active streak exists.
    - **Your Activity**: You failed Cold Shower for Apr 27.
    - **Friend Activity**: Morgan failed Cold Shower for Apr 27.

---

### CATEGORY 2: SOCIAL & SHARING

*Triggers for visibility and network actions.*

- **Trigger: Public Commitment (New Habit)**
    - **Content**: Triggered only when a user creates a new habit and selects specific friends to share it with.
    - **Your Activity**: You committed to a new habit: Morning Workout on Apr 27.
    - **Friend Activity**: Alex committed to a new habit: Morning Workout on Apr 27.
- **Trigger: Shared a habit with you**
    - **Content**: A user grants visibility into one of their existing habits.
    - **Your Activity**: You shared Morning Workout with Morgan on Apr 27.
    - **Friend Activity**: Alex shared Morning Workout with you on Apr 27.

---

### CATEGORY 3: STREAK DYNAMICS

*Chronological triggers for building, maintaining, or losing momentum from Day 2 onwards.*

- **Trigger: Started a Streak (Day 2)**
    - **Content**: The transition from an isolated log to a streak. (Skipped under the Veteran Habit Rule).
    - **Your Activity**: You started a streak by completing Morning Workout for Apr 27. That’s 2 in row!
    - **Friend Activity**: Alex started a streak by completing Morning Workout for Apr 27. That’s 2 in row!
- **Trigger: Day 3 & Day 4 Completion**
    - **Content**: Reaching the 3-day or 4-day mark with a neutral tone (ends in a period). (Skipped under the Veteran Habit Rule).
    - **Your Activity**: You hit a 3-day streak by completing Morning Workout for Apr 27.
    - **Friend Activity**: Alex hit a 4-day streak by completing Morning Workout for Apr 27.
- **Trigger: Streak Milestone Reached**
    - **Content**: Hitting a major threshold from the list (5, 7, 14, 21, 30, 60, 90, 100, 180, 300). (Day 5 is skipped under the Veteran Habit Rule).
    - **Your Activity**: You hit a 100-day streak by completing Read 20 Pages for Apr 27!
    - **Friend Activity**: Jordan hit a 300-day streak by completing Read 20 Pages for Apr 27!
- **Trigger: Annual Anniversary**
    - **Content**: Reaching exactly 365 days or any multiple thereof, formatted to show years and total days in parentheses.
    - **Your Activity**: You hit a 1-year streak (365 days) by completing Morning Workout for Apr 27!
    - **Friend Activity**: Jordan hit a 2-year streak (730 days) by completing Read 20 Pages for Apr 27!
- **Trigger: Post-Year Milestone Reached**
    - **Content**: Hitting a standard milestone after an annual anniversary. Formatted to show years, days, and total days in parentheses.
    - **Your Activity**: You hit a 2-year and 90-day streak (820 days) by completing Morning Workout for Apr 27!
    - **Friend Activity**: Jordan hit a 1-year and 180-day streak (545 days) by completing Read 20 Pages for Apr 27!
- **Trigger: Standard Streak Extension**
    - **Content**: Ongoing completions on non-milestone days (e.g., Day 10).
    - **Your Activity**: You completed Morning Workout for Apr 27—extending your streak to 10 days!
    - **Friend Activity**: Alex completed Morning Workout for Apr 27—extending their streak to 10 days!
- **Trigger: Post-Year Standard Streak Extension**
    - **Content**: Ongoing completions on non-milestone days after the first year.
    - **Your Activity**: You completed Morning Workout for Apr 27—extending your streak to 1-year and 12 days (377 days)!
    - **Friend Activity**: Alex completed Morning Workout for Apr 27—extending their streak to 1-year and 12 days (377 days)!
- **Trigger: Streak Maintained (Skip)**
    - **Content**: Skipping a habit while a streak is active (the streak is paused and protected).
    - **Your Activity**: You skipped No Sugar for Apr 26; your 5-day streak remains intact.
    - **Friend Activity**: Taylor skipped No Sugar for Apr 26; their 1-year and 20-day streak (385 days) remains intact.
- **Trigger: Streak Broken (Fail/Miss)**
    - **Content**: A failure or missed day that resets an active streak to zero.
    - **Your Activity**: You failed Cold Shower for Apr 27, bringing your 60-day streak to an end.
    - **Friend Activity**: Morgan failed Cold Shower for Apr 27, bringing a 1-year and 20-day streak (385 days) to an end.

# Habits Social: Activity Feed Implementation Plan

## Phase 1: Database Schema and Model Updates
To support Category 3 milestone triggers without recalculating history on every feed load, a new data point must be introduced to individual log entries.
* **Action:** Add a `streakCount` (number) property to the `IHabitLog` interface in `server/models/index.ts`.
* **Action:** Create and run a database migration to add the `streakCount` integer column to the `habitlogs` PostgreSQL table.

## Phase 2: Upgrading the Streak Calculation Engine (The Cascading Update)
The backend currently calculates the streak in memory whenever a log is modified. This engine must be upgraded to stamp and maintain the specific log's historical streak number directly in the database.
* **Action:** Update `server/utils/streaks.ts` so that when it determines the streak count for a specific calendar date, it executes an `UPDATE` query to save that integer into the new `streakCount` column of that specific log.
* **Action:** Implement Cascading Update Logic. When a user retroactively logs, modifies, or deletes a past entry, the engine will fetch all historical logs. As it recalculates the timeline, it will execute an `UPDATE` on the `habitlogs` table to continuously overwrite and restamp the `streakCount` column for **every subsequent log** that occurred after the changed date. This ensures that a modified past action instantly corrects the mathematical reality of the entire historical chain.

## Phase 3: The Feed Aggregation API (New Endpoint)
A new API route is required to aggregate and deliver the feed payload to the frontend.
* **Action:** Create a new endpoint (e.g., `/api/social/feed`).
* **Action:** Query the database for all `habitlogs` belonging to users that are in the requesting user's `friendships` table with an active status.
* **Action:** Apply the multi-tier sorting logic directly in the SQL query: `ORDER BY date DESC, updatedat DESC, id DESC`. This guarantees perfectly deterministic sorting, using the assigned habit date as the primary ledger, the exact server action timestamp as the secondary real-time push, and the internal row ID as the final absolute tie-breaker.
* **Action:** Dynamically append Category 2 (Social & Sharing) events to this payload by querying the `sharedwith` array on the `habits` table and anchoring them by the habit's `createdAt` date.

## Phase 4: Frontend UI and Trigger Logic Implementation
With the data structured and sorted by the backend, the frontend implementation focuses purely on rendering the correct strings.
* **Action:** Build the base UI feed component that iterates through the API payload, grouping items visually by their assigned `date` property.
* **Action:** Implement a mapping function to handle Category 1 triggers (`status` === 'skipped' or 'failed', or `status` === 'completed' where `streakCount` is 1).
* **Action:** Implement Category 3 triggers. The UI will strictly read the `streakCount` integer directly from the log payload and cross-reference it against the Standard Milestones array (2, 3, 4, 5, 7, 14, 21, 30, etc.) to inject the correct formatted string.
* **Action:** Add the logic for the Veteran Habit Rule and Post-Year Formatting Rule, checking if the `streakCount` exceeds 365 to adjust the string output accordingly.