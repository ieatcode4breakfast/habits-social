# Habit Tracking Feed & Milestone Logic

This document outlines the logic, formatting rules, and trigger events for the habit tracking activity feed. It is designed to reward consistency, prevent notification fatigue, and clearly communicate habit progress between friends.

---

## 1. Milestone Days & Core Rules

### Standard Milestones
Milestones are triggered on the following streak days: **2, 3, 4, 5, 7, 14, 21, 30, 60, 90, 100, 180, 300, Annual (every 365 days).**

### The Veteran Habit Rule
A habit is considered a "veteran" only while its **current active streak** is 365 days or longer. If a streak breaks, the habit returns to "rookie" status, ensuring that starting a fresh streak still triggers early milestones (2, 3, 4, and 5 days) for encouragement. Veteran status (and the skipping of early milestones) only applies once the current streak has surpassed those milestones.

### Post-Year Formatting Rule
Everything starting at 365 days must be explicitly formatted to show the years and days, followed by the total days in parentheses.
* **Example:** 1-year and 20-day streak (385 days)

---

## 2. Activity Feed Triggers

### CATEGORY 1: INITIAL & ISOLATED LOGS [COMPLETED]
Triggers for the first log of a potential streak (Day 1) or actions taken when no active streak exists.

* **Trigger 1.1: Initial Completion (Day 1)** [COMPLETED]
    * **Content:** The very first completion for a habit that has no prior streak history.
    * **Your Activity:** You completed Morning Workout for Apr 27.
    * **Friend Activity:** Alex completed Morning Workout for Apr 27.
* **Trigger 1.2: Initial Skip** [COMPLETED]
    * **Content:** Marking a habit as skipped when no active streak exists.
    * **Your Activity:** You skipped No Sugar for Apr 27.
    * **Friend Activity:** Taylor skipped No Sugar for Apr 27.
* **Trigger 1.3: Initial Failure** [COMPLETED]
    * **Content:** Marking a habit as failed when no active streak exists.
    * **Your Activity:** You failed Cold Shower for Apr 27.
    * **Friend Activity:** Morgan failed Cold Shower for Apr 27.

### CATEGORY 2: STREAK DYNAMICS
Chronological triggers for building, maintaining, or losing momentum from Day 2 onwards.

* **Trigger 2.1: Started a Streak (Day 2)**
    * **Content:** The transition from an isolated log to a streak.
    * **Your Activity:** You started a streak by completing Morning Workout for Apr 27. That’s 2 in row!
    * **Friend Activity:** Alex started a streak by completing Morning Workout for Apr 27. That’s 2 in row!
* **Trigger 2.2: Day 3 & Day 4 Completion**
    * **Content:** Reaching the 3-day or 4-day mark with a neutral tone (ends in a period).
    * **Your Activity:** You hit a 3-day streak by completing Morning Workout for Apr 27.
    * **Friend Activity:** Alex hit a 4-day streak by completing Morning Workout for Apr 27.
* **Trigger 2.3: Streak Broken (Fail/Miss)**
    * **Content:** A failure or missed day that resets an active streak to zero.
    * **Your Activity:** You failed Cold Shower for Apr 27, bringing your 60-day streak to an end.
    * **Friend Activity:** Morgan failed Cold Shower for Apr 27, bringing a 1-year and 20-day streak (385 days) to an end.
* **Trigger 2.4: Streak Milestone Reached**
    * **Content:** Hitting a major threshold from the list (5, 7, 14, 21, 30, 60, 90, 100, 180, 300).
    * **Your Activity:** You hit a 100-day streak by completing Read 20 Pages for Apr 27!
    * **Friend Activity:** Jordan hit a 300-day streak by completing Read 20 Pages for Apr 27!
* **Trigger 2.5: Annual Anniversary**
    * **Content:** Reaching exactly 365 days or any multiple thereof, formatted to show years and total days in parentheses.
    * **Your Activity:** You hit a 1-year streak (365 days) by completing Morning Workout for Apr 27!
    * **Friend Activity:** Jordan hit a 2-year streak (730 days) by completing Read 20 Pages for Apr 27!
* **Trigger 2.6: Post-Year Milestone Reached**
    * **Content:** Hitting a standard milestone after an annual anniversary. Formatted to show years, days, and total days in parentheses.
    * **Your Activity:** You hit a 2-year and 90-day streak (820 days) by completing Morning Workout for Apr 27!
    * **Friend Activity:** Jordan hit a 1-year and 180-day streak (545 days) by completing Read 20 Pages for Apr 27!
* **Trigger 2.7: Standard Streak Extension**
    * **Content:** Ongoing completions on non-milestone days (e.g., Day 10).
    * **Your Activity:** You completed Morning Workout for Apr 27—extending your streak to 10 days!
    * **Friend Activity:** Alex completed Morning Workout for Apr 27—extending their streak to 10 days!
* **Trigger 2.8: Post-Year Standard Streak Extension**
    * **Content:** Ongoing completions on non-milestone days after the first year.
    * **Your Activity:** You completed Morning Workout for Apr 27—extending your streak to 1-year and 12 days (377 days)!
    * **Friend Activity:** Alex completed Morning Workout for Apr 27—extending their streak to 1-year and 12 days (377 days)!
* **Trigger 2.9: Streak Maintained (Skip)**
    * **Content:** Skipping a habit while a streak is active (the streak is paused and protected).
    * **Your Activity:** You skipped No Sugar for Apr 26; your 5-day streak remains intact.
    * **Friend Activity:** Taylor skipped No Sugar for Apr 26; their 1-year and 20-day streak (385 days) remains intact.

### CATEGORY 3: SOCIAL & SHARING
Triggers for visibility and network actions.

* **Trigger 3.1: Public Commitment (New Habit)**
    * **Content:** Triggered only when a user creates a new habit and selects specific friends to share it with.
    * **Your Activity:** You committed to a new habit: Morning Workout on Apr 27.
    * **Friend Activity:** Alex committed to a new habit: Morning Workout on Apr 27.
* **Trigger 3.2: Shared a habit with you**
    * **Content:** A user grants visibility into one of their existing habits.
    * **Your Activity:** You shared Morning Workout with Morgan on Apr 27.
    * **Friend Activity:** Alex shared Morning Workout with you on Apr 27.

# Habits Social: Activity Feed Implementation Plan

## Phase 1: Database Schema and Model Updates [COMPLETED]
To support milestone triggers without recalculating history on every feed load, new data points were introduced to individual log entries.
* **Action [x]:** Add a `streakCount` (number) and `brokenStreakCount` (number) property to the `IHabitLog` interface in `server/models/index.ts`.
* **Action [x]:** Create and run a database migration to add the `streakCount` and `brokenStreakCount` integer columns to the `habitlogs` PostgreSQL table.

## Phase 2: Upgrading the Streak Calculation Engine [COMPLETED]
The backend calculates the streak and stamps it directly into the database logs.
* **Action [x]:** Implement Cascading Update Logic in `server/utils/streaks.ts`. When a user logs or modifies an entry, the engine fetches all historical logs in ascending order. It continuously overwrites the `streakCount` column for every subsequent log, correcting the mathematical reality of the entire chain.
* **Action [x]:** Calculate failures. Update the cascading logic to stamp `brokenStreakCount` on logs with a `failed` status, capturing the streak value immediately before the failure.
* **Action [x]:** Update parent habit metadata. The engine concludes by executing an `UPDATE` on the `habits` table to recalculate and store the `longestStreak` and the new `streakAnchorDate`.
* **Core Architectural Rule:** The cascading engine uses a strict daily consecutive check. This is an intentional design choice to reward daily accountability and continuity. A gap of >1 day between logs breaks the streak, but the system is "forgiving" as it allows users to retroactively log missed days to mend the chain. Frequency settings (weekly/monthly) are for visual progress only and must NOT be incorporated into the streak engine.

## Phase 3: The Feed Aggregation API [COMPLETED - Categories 1 & 2]
The backend provides "Ready-to-Render" activity events via the `/api/social/feed` endpoint.
* **Action [x]:** Query the database for `habitlogs` belonging to active friends (where `sharedwith` includes the user) **AND** the user's own logs, allowing personal activity to appear in the feed.
* **Action [x]:** Hydrate events with `username` and `photourl` by joining with the `users` and `habits` tables. Apply a `LIMIT 100` to the query.
* **Action [x]:** Implement the "Narrator" logic to structure the payload. Drop raw schema output in favor of nested `user` and `habit` objects. Explicitly convert the username to 'You' if the log belongs to the authenticated user.
* **Action [x]:** Apply multi-tier sorting: `ORDER BY date DESC, updatedat DESC, id DESC`.

## Phase 4: Frontend UI and Interactive Feed [COMPLETED - Categories 1 & 2]
The frontend consumes the feed and handles layout, routing, and styling.
* **Action [x]:** Build the UI Feed component that iterates through the API payload and groups items visually by their assigned `date` property.
* **Action [x]:** Implement conditional routing on Avatar & Name: Navigate to the friend's profile only if the activity belongs to a friend (preventing self-routing).
* **Action [x]:** Implement inline details: Clicking a feed card opens the **Habit Details Modal** (`openHabitDetails`), instead of routing to a specific habit view page.
* **Action [x]:** Apply dynamic styling based on the event `type` (e.g., an emerald Check for `INITIAL_COMPLETION`, a rose X icon for `INITIAL_FAILURE`, etc.).