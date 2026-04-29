# Habit Tracking Activity Feed & Social Logic

This document serves as the authoritative reference for the architecture, logic, formatting rules, and trigger events of the habit tracking activity feed. It is designed to reward consistency, prevent notification fatigue, clearly communicate habit progress between friends, and ensure reliable sorting.

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

## 2. Streak Engine Architecture

The backend calculates the streak and stamps it directly into the database logs to support milestone triggers without recalculating history on every feed load.

* **Cascading Update Logic:** When a user logs or modifies an entry, the engine fetches all historical logs in ascending order. It continuously overwrites the `streakCount` column for every subsequent log, correcting the mathematical reality of the entire chain.
* **Failure Calculation:** The cascading logic stamps the `brokenStreakCount` on logs with a `failed` status, capturing the streak value immediately before the failure.
* **Parent Metadata:** The engine concludes by updating the `habits` table to recalculate and store the `longestStreak` and the new `streakAnchorDate`.
* **Core Architectural Rule:** The cascading engine uses a strict daily consecutive check. This is an intentional design choice to reward daily accountability and continuity. A gap of >1 day between logs breaks the streak, but the system is "forgiving" as it allows users to retroactively log missed days to mend the chain. Frequency settings (weekly/monthly) are for visual progress only and must NOT be incorporated into the streak engine.

---

## 3. Feed Aggregation & Sorting

The backend provides "Ready-to-Render" activity events via the `/api/social/feed` endpoint, combining data from three distinct tables: `habitlogs`, `habits` (for commitments), and `share_events`.

* **Query Logic:** The system fetches events belonging to active friends (where `sharedwith` includes the user) **AND** the user's own events, allowing personal activity to appear in the feed.
* **Hydration & Mapping:** Events are hydrated with user profiles and mapped using a "Narrator" logic to structure the payload into distinct types (`INITIAL_COMPLETION`, `STREAK_STARTED`, `SHARE`, etc.). If an event belongs to the authenticated user, the username is explicitly converted to 'You'.
* **Multi-Tier Sorting:** Feed events are sorted strictly using `ORDER BY date DESC, updatedat DESC, id DESC`.
* **Timezone Importance:** To ensure accurate cross-timezone sorting between `habitlogs` and `share_events`, it is critical that timestamps are stored using `TIMESTAMPTZ`.

---

## 4. UI & Interactive Behaviors

The frontend consumes the feed and handles layout, routing, and styling in the `social.vue` view.

* **Visual Grouping:** The UI iterates through the API payload and groups items visually by their assigned local `date` property.
* **Avatar Routing:** Clicking an avatar navigates to the friend's profile. This is conditionally disabled for the authenticated user to prevent self-routing.
* **Inline Details (Single Habit):** Clicking a single-habit feed card opens the **Habit Details Modal**, bypassing a separate page load. If the habit is no longer shared with the user, the 404 error is intercepted and a toast notification is displayed.
* **Batch-Share Fallback:** Clicking a batch-share feed card (which groups multiple habits and lacks a specific habit ID) gracefully falls back to navigating to the friend's profile.
* **Event Styling Mapping:**
    * Emerald `Check` icon for `INITIAL_COMPLETION`
    * Rose `XIcon` for `INITIAL_FAILURE`
    * Rose `HeartCrack` icon for `STREAK_BROKEN`
    * Violet `Trophy` icon for Milestones and Anniversaries
    * Amber `Flame` icon for streak continuations/extensions
    * Zinc `Shield` icon for `STREAK_MAINTAINED` (Skips)
    * Indigo `Target` icon for `COMMITMENT` (New Habit)
    * Sky `Share2` icon for `SHARE` (Shared Habits)

---

## 5. Event Triggers Reference

### CATEGORY 1: INITIAL & ISOLATED LOGS
Triggers for the first log of a potential streak (Day 1) or actions taken when no active streak exists.

* **Trigger 1.1: Initial Completion (Day 1)**
    * **Content:** The very first completion for a habit that has no prior streak history.
    * **Your Activity:** You completed Morning Workout for Apr 27.
    * **Friend Activity:** Alex completed Morning Workout for Apr 27.
* **Trigger 1.2: Initial Skip**
    * **Content:** Marking a habit as skipped when no active streak exists.
    * **Your Activity:** You skipped No Sugar for Apr 27.
    * **Friend Activity:** Taylor skipped No Sugar for Apr 27.
* **Trigger 1.3: Initial Failure**
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
    * **Content:** A user grants visibility into one or more habits. Grouped: if multiple habits are shared at once, a single event is produced.
    * **Your Activity (1 habit):** You shared Morning Workout with Morgan on Apr 27.
    * **Your Activity (N habits):** You shared 3 habits with Morgan on Apr 27.
    * **Friend Activity (1 habit):** Alex shared Morning Workout with you on Apr 27.
    * **Friend Activity (N habits):** Alex shared 3 habits with you on Apr 27.
